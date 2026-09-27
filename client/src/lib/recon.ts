/** Client for the built-in infrastructure recon (domain / IP). */
import { api } from './api';

export interface ReconLink { label: string; url: string }
export interface ReconFlag { source: string; level: string; detail: string; url?: string }
export interface DnsRecords { a: string[]; aaaa: string[]; mx: string[]; ns: string[]; txt: string[] }
export interface IpInfo { ok: boolean; network?: string | null; handle?: string | null; country?: string | null; type?: string | null; cidr?: string | null; org?: string | null; abuse?: string | null; error?: string }
export interface Registration { ok: boolean; registrar?: string | null; created?: string | null; updated?: string | null; expires?: string | null; statuses?: string[]; nameservers?: string[]; org?: string | null; country?: string | null; abuse?: string | null; error?: string }
export interface ReconResult {
  target: { kind: 'domain' | 'ipv4' | 'ipv6'; value: string };
  dns?: DnsRecords;
  host?: IpInfo | null;
  subdomains?: { names: string[]; truncated: boolean; source?: string; error?: string };
  registration?: Registration;
  ipInfo?: IpInfo;
  ptr?: string[];
  reputation: ReconFlag[];
  archive: { available: boolean; url?: string; timestamp?: string; viewer?: string };
  links: ReconLink[];
  checkedAt: number;
}

export const runRecon = (target: string) => api<ReconResult>('/recon', { body: { target } });
