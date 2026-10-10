// Entity pivot / link-analysis transforms.
import { api } from './api';

export interface GraphNode { id: string; label: string; type: string }
export interface GraphEdge { source: string; target: string; label: string }
export interface PivotResult { type: string; value: string; nodes: GraphNode[]; edges: GraphEdge[] }

export const runPivot = (value: string, type = 'auto') =>
  api<PivotResult>(`/pivot?value=${encodeURIComponent(value)}&type=${encodeURIComponent(type)}`);
