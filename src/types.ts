export interface StreamCredentials {
  serverUrl: string;
  username: string;
  password: string;
  isDemo?: boolean;
}

export interface UserInfo {
  username: string;
  status: string;
  exp_date?: string;
  is_trial?: string;
  active_cons?: string;
  max_connections?: string;
  created_at?: string;
  allowed_output_formats?: string[];
}

export interface ServerInfo {
  url?: string;
  port?: string;
  server_protocol?: string;
  timezone?: string;
  timestamp_now?: number;
}

export interface Category {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

export interface StreamChannel {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number | string;
  stream_icon?: string;
  category_id: string;
  category_name?: string;
  direct_source?: string;
  epg_channel_id?: string;
  added?: string;
  custom_sid?: string | null;
}

export type ViewMode = 'login' | 'choice' | 'download' | 'channels' | 'range_generator' | 'link_master' | 'track_url' | 'verifier';

export type Language = 'en' | 'hi' | 'pa' | 'bn' | 'or' | 'ta' | 'te' | 'ml' | 'gu' | 'kn';
