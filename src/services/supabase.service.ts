import { Injectable } from '@angular/core';
import { GuestbookEntry } from '../types/guestbook.types';

// Let TypeScript know about the global supabase object from the CDN
declare const supabase: any;

// Configuration is now internal to the service to prevent load-time errors.
// FIX: Explicitly type constants as string to prevent TypeScript from inferring a literal type,
// which causes an error when comparing against placeholder strings in `isConfigured`.
const SUPABASE_URL: string = 'https://xyhlmtjaxoyrddivsbls.supabase.co';
const SUPABASE_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5aGxtdGpheG95cmRkaXZzYmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTMwOTgsImV4cCI6MjA4NDU4OTA5OH0.KhhjIp4OL5EOsnqXPBX-soXx0gr2nl7OO_Ce-536sQ8';


@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabaseClient: any; // Type would be SupabaseClient if using npm package

  constructor() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase client is not available. Check the CDN script in index.html.');
        this.supabaseClient = null;
        return;
    }

    if (this.isConfigured()) {
        this.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        this.supabaseClient = null;
    }
  }
  
  isConfigured(): boolean {
    // Check for actual values, not just the placeholder strings.
    return !!SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
           !!SUPABASE_KEY && SUPABASE_KEY !== 'YOUR_SUPABASE_ANON_KEY';
  }

  getSupabaseUrl(): string | null {
    return this.isConfigured() ? SUPABASE_URL : null;
  }

  async getGuestbookEntries(): Promise<{ data: GuestbookEntry[] | null; error: any }> {
    if (!this.supabaseClient) {
        return { data: null, error: { message: 'Supabase client is not configured.' }};
    }
    const { data, error } = await this.supabaseClient
      .from('guestbook')
      .select('*')
      .order('created_at', { ascending: false });
    
    return { data, error };
  }

  async addGuestbookEntry(name: string, message: string): Promise<{ data: GuestbookEntry[] | null; error: any }> {
    if (!this.supabaseClient) {
        return { data: null, error: { message: 'Supabase client is not configured.' }};
    }
    const { data, error } = await this.supabaseClient
      .from('guestbook')
      .insert([{ name, message }])
      .select();

    return { data, error };
  }

  listenToGuestbookChanges(callback: (newEntry: GuestbookEntry) => void): any {
    if (!this.supabaseClient) {
      return null;
    }
    const channel = this.supabaseClient
      .channel('guestbook-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'guestbook' },
        (payload: { new: GuestbookEntry }) => {
          callback(payload.new);
        }
      )
      .subscribe();
    
    return channel;
  }
}
