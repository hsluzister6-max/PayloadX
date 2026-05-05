import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import RequestModel from '../models/Request.js';
import { z } from 'zod';

const requestSchema = z.object({
  name: z.string().min(1),
  method: z.string().default('GET'),
  url: z.string().url(),
  headers: z.array(z.any()).optional(),
  params: z.array(z.any()).optional(),
  body: z.any().optional(),
  projectId: z.string()
});

export const getRequests = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;
    const filter: any = { userId: req.user?.id };
    if (projectId) filter.projectId = projectId;

    const requests = await RequestModel.find(filter);
    res.status(200).json({ requests });
  } catch (err: any) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
};

export const createRequest = async (req: AuthRequest, res: Response) => {
  try {
    const data = requestSchema.parse(req.body);
    const request = new RequestModel({
      ...data,
      userId: req.user?.id
    });
    await request.save();
    res.status(201).json({ request });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: err.errors });
    }
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
};

export const updateRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = requestSchema.parse(req.body);
    
    const request = await RequestModel.findOneAndUpdate(
      { _id: id, userId: req.user?.id },
      { ...data, updatedAt: new Date() },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ error: 'Not Found', message: 'Request not found' });
    }

    res.status(200).json({ request });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: err.errors });
    }
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
};

export const deleteRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const request = await RequestModel.findOneAndDelete({ _id: id, userId: req.user?.id });

    if (!request) {
      return res.status(404).json({ error: 'Not Found', message: 'Request not found' });
    }

    res.status(200).json({ message: 'Request deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
};
