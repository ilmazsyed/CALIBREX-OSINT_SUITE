/** Live Cameras: public broadcast video feeds (YouTube channels + proxied MJPEG). */
import { api } from './api';

export interface Camera {
  id: string;
  name: string;
  place: string;
  region: string;
  kind: 'youtube' | 'mjpeg';
  channel?: string; // youtube
  stream?: string;  // mjpeg — same-origin proxy path
  note?: string;
}
export const getCameras = () => api<{ cameras: Camera[] }>('/cameras');
