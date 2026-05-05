import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import Project from '../models/Project.js';
import { z } from 'zod';

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
});

export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const projects = await Project.find({ userId: req.user?.id });
    res.status(200).json({ projects });
  } catch (err: any) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
};

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = projectSchema.parse(req.body);
    const project = new Project({
      name,
      description,
      userId: req.user?.id
    });
    await project.save();
    res.status(201).json({ project });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: err.errors });
    }
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = projectSchema.parse(req.body);
    
    const project = await Project.findOneAndUpdate(
      { _id: id, userId: req.user?.id },
      { name, description, updatedAt: new Date() },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ error: 'Not Found', message: 'Project not found' });
    }

    res.status(200).json({ project });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: err.errors });
    }
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const project = await Project.findOneAndDelete({ _id: id, userId: req.user?.id });

    if (!project) {
      return res.status(404).json({ error: 'Not Found', message: 'Project not found' });
    }

    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
};
