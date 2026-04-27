/**
 * Environment Routes
 * GET /api/environment?projectId=&teamId=&includeGlobal=
 * POST /api/environment
 * GET /api/environment/:id
 * PUT /api/environment/:id
 * DELETE /api/environment/:id
 * GET /api/environment/:id/variables
 * POST /api/environment/:id/variables
 * PUT /api/environment/:id/variables
 */

import express from 'express';
import Environment, { maskSecrets } from '../../models/Environment.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/environment
router.get('/', authenticate, async (req, res) => {
  try {
    const { projectId, teamId, includeGlobal } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId query param is required' });
    }

    // Build query — optionally include global team environments
    let envs;
    if (includeGlobal === 'true' && teamId) {
      envs = await Environment.find({
        $or: [
          { projectId },
          { teamId, isGlobal: true },
        ],
      }).sort({ isGlobal: -1, name: 1 });
    } else {
      envs = await Environment.find({ projectId }).sort({ name: 1 });
    }

    const safeEnvs = envs.map(maskSecrets);

    res.json({ environments: safeEnvs, count: safeEnvs.length });
  } catch (err) {
    console.error('[GET /api/environment]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/environment
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      projectId,
      teamId,
      description = '',
      color = '#6366f1',
      isGlobal = false,
      variables = [],
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Environment name is required' });
    }
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    // Check for duplicate name in project
    const existing = await Environment.findOne({ projectId, name: name.trim() });
    if (existing) {
      return res.status(409).json({ error: `An environment named "${name.trim()}" already exists in this project` });
    }

    // Sanitize and validate variables
    const sanitizedVars = sanitizeVariables(variables);

    const env = await Environment.create({
      name: name.trim(),
      description: description.trim(),
      projectId,
      teamId,
      createdBy: userId,
      color,
      isGlobal,
      variables: sanitizedVars,
    });

    res.status(201).json({ message: 'Environment created', environment: maskSecrets(env) });
  } catch (err) {
    console.error('[POST /api/environment]', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An environment with this name already exists in this project' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/environment/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { revealSecrets } = req.query;
    const env = await Environment.findById(req.params.id);
    if (!env) return res.status(404).json({ error: 'Environment not found' });

    res.json({ environment: revealSecrets === 'true' ? env.toObject() : maskSecrets(env) });
  } catch (err) {
    console.error('[GET /api/environment/:id]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/environment/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, description, color, isGlobal, variables } = req.body;

    const env = await Environment.findById(req.params.id);
    if (!env) return res.status(404).json({ error: 'Environment not found' });

    // Duplicate name check (ignore self)
    if (name && name.trim() !== env.name) {
      const dup = await Environment.findOne({
        projectId: env.projectId,
        name: name.trim(),
        _id: { $ne: req.params.id },
      });
      if (dup) {
        return res.status(409).json({ error: `Environment named "${name.trim()}" already exists in this project` });
      }
      env.name = name.trim();
    }

    if (description !== undefined) env.description = description.trim();
    if (color !== undefined) env.color = color;
    if (isGlobal !== undefined) env.isGlobal = Boolean(isGlobal);

    // Variables: merge — preserve secret values for masked variables (value === '')
    if (Array.isArray(variables)) {
      env.variables = mergeVariables(env.variables, variables);
    }

    await env.save();
    res.json({ message: 'Environment updated', environment: maskSecrets(env) });
  } catch (err) {
    console.error('[PUT /api/environment/:id]', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An environment with this name already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/environment/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const env = await Environment.findByIdAndDelete(req.params.id);
    if (!env) return res.status(404).json({ error: 'Environment not found' });

    res.json({ message: 'Environment deleted', id: req.params.id });
  } catch (err) {
    console.error('[DELETE /api/environment/:id]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// Variables Routes
// ───────────────────────────────────────────────────────────────────────────────

// GET /api/environment/:id/variables
router.get('/:id/variables', authenticate, async (req, res) => {
  try {
    const { revealSecrets } = req.query;
    const env = await Environment.findById(req.params.id);
    if (!env) return res.status(404).json({ error: 'Environment not found' });

    const variables = env.variables.map((v) => ({
      _id: v._id,
      key: v.key,
      value: v.isSecret && revealSecrets !== 'true' ? '' : v.value,
      description: v.description,
      isSecret: v.isSecret,
      enabled: v.enabled,
      _masked: v.isSecret && revealSecrets !== 'true',
    }));

    res.json({ variables, count: variables.length });
  } catch (err) {
    console.error('[GET /api/environment/:id/variables]', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/environment/:id/variables (Add a single variable)
router.post('/:id/variables', authenticate, async (req, res) => {
  try {
    const { key, value = '', description = '', isSecret = false, enabled = true } = req.body;

    if (!key?.trim()) {
      return res.status(400).json({ error: 'Variable key is required' });
    }

    const env = await Environment.findById(req.params.id);
    if (!env) return res.status(404).json({ error: 'Environment not found' });

    // Check duplicate key
    if (env.variables.some((v) => v.key === key.trim())) {
      return res.status(409).json({ error: `Variable "${key.trim()}" already exists in this environment` });
    }

    env.variables.push({ key: key.trim(), value, description, isSecret, enabled });
    await env.save();

    res.status(201).json({
      message: 'Variable added',
      variable: env.variables[env.variables.length - 1],
    });
  } catch (err) {
    console.error('[POST /api/environment/:id/variables]', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PUT /api/environment/:id/variables (Bulk replace all variables)
router.put('/:id/variables', authenticate, async (req, res) => {
  try {
    const { variables } = req.body;

    if (!Array.isArray(variables)) {
      return res.status(400).json({ error: 'variables must be an array' });
    }

    const env = await Environment.findById(req.params.id);
    if (!env) return res.status(404).json({ error: 'Environment not found' });

    // Smart merge — preserve secret values for masked items
    const merged = variables
      .filter((v) => v.key?.trim())
      .map((incoming) => {
        const existing = env.variables.find((e) => e.key === incoming.key.trim());
        const isSecret = Boolean(incoming.isSecret);
        let value = incoming.value ?? '';
        if (isSecret && value === '' && existing?.isSecret) value = existing.value;
        return {
          key: incoming.key.trim(),
          value,
          description: incoming.description ?? '',
          isSecret,
          enabled: incoming.enabled !== false,
        };
      });

    env.variables = merged;
    await env.save();

    res.json({
      message: 'Variables saved',
      count: merged.length,
      environment: maskSecrets(env),
    });
  } catch (err) {
    console.error('[PUT /api/environment/:id/variables]', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

function sanitizeVariables(variables = []) {
  if (!Array.isArray(variables)) return [];
  return variables
    .filter((v) => v.key && v.key.trim())
    .map((v) => ({
      key: v.key.trim(),
      value: v.value ?? '',
      description: v.description ?? '',
      isSecret: Boolean(v.isSecret),
      enabled: v.enabled !== false,
    }));
}

/**
 * Smart merge: if a secret variable comes back with value='' (masked),
 * keep the existing stored value instead of overwriting with empty string.
 */
function mergeVariables(existingVars, incomingVars) {
  return incomingVars
    .filter((v) => v.key && v.key.trim())
    .map((incoming) => {
      const existing = existingVars.find((e) => e.key === incoming.key.trim());

      const isSecret = Boolean(incoming.isSecret);
      // If the variable is secret and the incoming value is empty (masked),
      // preserve the stored secret value
      let value = incoming.value ?? '';
      if (isSecret && value === '' && existing?.isSecret) {
        value = existing.value;
      }

      return {
        key: incoming.key.trim(),
        value,
        description: incoming.description ?? existing?.description ?? '',
        isSecret,
        enabled: incoming.enabled !== false,
      };
    });
}

export default router;
