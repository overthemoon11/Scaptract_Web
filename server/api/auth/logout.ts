import { Request, Response } from 'express';
import { serialize } from 'cookie';

export default function handler(_req: Request, res: Response) {
  res.setHeader(
    'Set-Cookie',
    serialize('token', '', {
      httpOnly: true,
      path: '/',
      expires: new Date(0),
    })
  );
  res.status(200).json({ message: 'Logged out' });
}

