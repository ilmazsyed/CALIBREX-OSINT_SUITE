
import React from 'react';

export type ViewState = 'dashboard' | 'geopolitical' | 'research' | 'report-gen' | 'dispatch-studio' | 'tools' | 'history' | 'alerts' | 'settings' | 'info' | 'threat-wire' | 'watchlists' | 'trends' | 'visual-intel' | 'subject-lookup' | 'markets' | 'signals' | 'cameras';

export interface NavItem {
  id: ViewState;
  label: string;
  icon: React.ReactNode;
}

export interface ReportVerification {
  score: number;
  verdict: 'CORROBORATED' | 'PARTIAL' | 'UNCORROBORATED';
  findings: string[];
  auditorLogic: string;
  sources?: { name: string; url: string }[];
  checkedAt?: number;
}

export interface IntelligenceNode {
  id: string;
  content: string;
  timestamp: string;
  source: string;
  pinned: boolean;
  url?: string;
  published?: number | null;
  verification?: {
    score: number;
    status: 'CORROBORATED' | 'LIMITED' | 'UNCORROBORATED';
    sources: { name: string; url: string }[];
    logic: string;
    checkedAt?: number;
    findings?: string[];
  };
}

export interface Threat {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  location?: string;
  coordinates?: [number, number]; // [lat, lng]
  details: { label: string; value: string }[];
  description?: string;
  category?: 'OSINT' | 'KINETIC' | 'CYBER' | 'FINANCIAL' | 'HAZARD';
  sources?: { title: string; url: string; source: string; published: number; kind?: string }[];
  assessedAt?: number;
}

export interface Stat {
  label: string;
  value: number | string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface Alert {
  id: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  url?: string;
  source?: string;
}

export interface ReportHistoryItem {
  id: string;
  title: string;
  date: string;
  format: string;
  content?: string;
  verification?: ReportVerification;
  userId: string; // Added userId to link reports to users
}

export interface ToolItem {
  title: string;
  description: string;
  url: string;
}
