import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import Workflow from '../models/Workflow.js';
import { z } from 'zod';

const workflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  nodes: z.array(z.any()).optional(),
  edges: z.array(z.any()).optional(),
  projectId: z.string()
});

export const getWorkflows = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;
    const filter: any = { userId: req.user?.id };
    if (projectId) filter.projectId = projectId;

    const workflows = await Workflow.find(filter);
    res.status(200).json({ workflows });
  } catch (err: any) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
};

export const createWorkflow = async (req: AuthRequest, res: Response) => {
  try {
    const data = workflowSchema.parse(req.body);
    const workflow = new Workflow({
      ...data,
      userId: req.user?.id
    });
    await workflow.save();
    res.status(201).json({ workflow });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: err.errors });
    }
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
};

export const updateWorkflow = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = workflowSchema.parse(req.body);
    
    const workflow = await Workflow.findOneAndUpdate(
      { _id: id, userId: req.user?.id },
      { ...data, updatedAt: new Date() },
      { new: true }
    );

    if (!workflow) {
      return res.status(404).json({ error: 'Not Found', message: 'Workflow not found' });
    }

    res.status(200).json({ workflow });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: err.errors });
    }
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
};

export const deleteWorkflow = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workflow = await Workflow.findOneAndDelete({ _id: id, userId: req.user?.id });

    if (!workflow) {
      return res.status(404).json({ error: 'Not Found', message: 'Workflow not found' });
    }

    res.status(200).json({ message: 'Workflow deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
};

export const executeWorkflow = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workflow = await Workflow.findOne({ _id: id, userId: req.user?.id });

    if (!workflow) {
      return res.status(404).json({ error: 'Not Found', message: 'Workflow not found' });
    }

    console.log(`Executing workflow: ${workflow.name}`);
    
    res.status(200).json({ 
      status: 'success', 
      message: 'Workflow execution started',
      executionId: Math.random().toString(36).substring(7)
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
};
