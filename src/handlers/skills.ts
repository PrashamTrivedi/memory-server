import { Context } from 'hono';
import { createHash, randomBytes } from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';
import { Env } from '../../types';
import {
  generateMcpJsonRedacted,
  getInstallationSteps,
  redactApiKey,
  generateSkillKeyName
} from '../skills/templates';

// KV TTL: 4 hours in seconds
const SKILL_PACKAGE_TTL = 14400;

interface SkillMetadata {
  token: string;
  skillKeyId: string;
  skillKeyName: string;
  apiKey: string; // Store actual key to return in reuse scenario
  createdAt: number;
  expiresAt: number;
}

interface ApiKeyContext {
  id: string;
  entityName: string;
}

// Type for context with Variables (from dualAuth middleware)
type AppContext = Context<{ Bindings: Env; Variables: { apiKey: ApiKeyContext } }>;

/**
 * Generate skill package with new skill-bound API key
 * POST /api/skills/generate
 *
 * Reuses existing package if called within 4-hour window
 */
export async function generateSkillPackage(c: AppContext) {
  try {
    const authKey = c.get('apiKey');

    if (!authKey) {
      return c.json({
        success: false,
        error: 'Authentication required'
      }, 401);
    }

    const parentKeyId = authKey.id;
    const serverUrl = new URL(c.req.url).origin;

    // Check for existing skill package (reuse logic)
    const metaKey = `skill-meta:${parentKeyId}`;
    const existingMeta = await c.env.CACHE_KV.get<SkillMetadata>(metaKey, 'json');

    if (existingMeta && existingMeta.expiresAt > Math.floor(Date.now() / 1000)) {
      // Reuse existing package
      const remainingTtl = existingMeta.expiresAt - Math.floor(Date.now() / 1000);

      return c.json({
        success: true,
        reused: true,
        download_url: `/skills/download/${existingMeta.token}`,
        expires_in: remainingTtl,
        skill_key: {
          id: existingMeta.skillKeyId,
          entity_name: existingMeta.skillKeyName,
          created_at: existingMeta.createdAt
        },
        instructions: {
          mcp_config_redacted: generateMcpJsonRedacted(serverUrl, redactApiKey(existingMeta.apiKey)),
          steps: getInstallationSteps()
        }
      });
    }

    // Generate new skill-bound API key
    const skillKeyName = generateSkillKeyName(authKey.entityName);
    const apiKey = 'msk_' + randomBytes(32).toString('hex');
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const skillKeyId = randomBytes(16).toString('hex');
    const now = Math.floor(Date.now() / 1000);

    // Insert skill-bound key into database
    const db = c.env.DB;
    await db
      .prepare(`
        INSERT INTO api_keys (id, key_hash, entity_name, created_at, is_active, key_type, parent_key_id)
        VALUES (?, ?, ?, ?, 1, 'skill-bound', ?)
      `)
      .bind(skillKeyId, keyHash, skillKeyName, now, parentKeyId)
      .run();

    // Fetch templates from R2
    const [skillMdTemplate, mcpJsonTemplate] = await Promise.all([
      c.env.SKILL_TEMPLATES.get('SKILL.md'),
      c.env.SKILL_TEMPLATES.get('mcp.json')
    ]);

    if (!skillMdTemplate || !mcpJsonTemplate) {
      console.error('Missing templates in R2:', {
        skillMd: !!skillMdTemplate,
        mcpJson: !!mcpJsonTemplate
      });
      return c.json({
        success: false,
        error: 'Skill templates not found'
      }, 500);
    }

    // Read template content and replace placeholders
    const skillMdContent = (await skillMdTemplate.text())
      .replace(/\{\{SERVER_URL\}\}/g, serverUrl);

    const mcpJsonContent = (await mcpJsonTemplate.text())
      .replace(/\{\{SERVER_URL\}\}/g, serverUrl)
      .replace(/\{\{API_KEY\}\}/g, apiKey);

    // Create ZIP using fflate
    const zipData = zipSync({
      'memory-skill/SKILL.md': strToU8(skillMdContent),
      'memory-skill/mcp.json': strToU8(mcpJsonContent)
    }, { level: 6 });

    // Generate download token
    const downloadToken = randomBytes(24).toString('hex');
    const expiresAt = now + SKILL_PACKAGE_TTL;

    // Store ZIP in KV - convert Uint8Array to ArrayBuffer for proper storage
    const zipKey = `skill-zip:${downloadToken}`;
    const zipBuffer = zipData.buffer.slice(zipData.byteOffset, zipData.byteOffset + zipData.byteLength) as ArrayBuffer;

    await c.env.CACHE_KV.put(zipKey, zipBuffer, {
      expirationTtl: SKILL_PACKAGE_TTL
    });

    // Store metadata in KV for reuse
    const metadata: SkillMetadata = {
      token: downloadToken,
      skillKeyId,
      skillKeyName,
      apiKey,
      createdAt: now,
      expiresAt
    };
    await c.env.CACHE_KV.put(metaKey, JSON.stringify(metadata), {
      expirationTtl: SKILL_PACKAGE_TTL
    });

    return c.json({
      success: true,
      reused: false,
      download_url: `/skills/download/${downloadToken}`,
      expires_in: SKILL_PACKAGE_TTL,
      skill_key: {
        id: skillKeyId,
        entity_name: skillKeyName,
        created_at: now
      },
      instructions: {
        mcp_config_redacted: generateMcpJsonRedacted(serverUrl, redactApiKey(apiKey)),
        steps: getInstallationSteps()
      }
    }, 201);
  } catch (error) {
    console.error('Generate skill package error:', error);
    return c.json({
      success: false,
      error: 'Failed to generate skill package',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

/**
 * Download skill package ZIP
 * GET /api/skills/download/:token
 *
 * No authentication required - token is the auth
 */
export async function downloadSkillPackage(c: Context<{ Bindings: Env }>) {
  try {
    const token = c.req.param('token');

    if (!token || token.length < 32) {
      return c.json({
        success: false,
        error: 'Invalid download token'
      }, 400);
    }

    const zipKey = `skill-zip:${token}`;
    const zipData = await c.env.CACHE_KV.get(zipKey, 'arrayBuffer');

    if (!zipData) {
      return c.json({
        success: false,
        error: 'Download token expired or invalid'
      }, 404);
    }

    return new Response(zipData, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="memory-skill.zip"',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Download skill package error:', error);
    return c.json({
      success: false,
      error: 'Failed to download skill package',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}
