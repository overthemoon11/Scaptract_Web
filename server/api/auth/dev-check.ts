import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') return res.status(405).end();

  const isDevMode = process.env.DEVMODE === 'true';
  
  res.status(200).json({ 
    devMode: isDevMode 
  });
}

