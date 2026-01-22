import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { GuestbookEntry } from '../types/guestbook.types';

// Let TypeScript know about the global supabase object from the CDN
declare const supabase: any;

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabaseClient: any; // Type would be SupabaseClient if using npm package

  constructor() {
    if (this.isConfigured()) {
        this.supabaseClient = supabase.createClient(environment.supabaseUrl, environment.supabaseKey);
    } else {
        console.error("Supabase URL and Key are not configured. Please check src/environments/environment.ts");
        this.supabaseClient = null;
    }
  }
  
  isConfigured(): boolean {
    // Check against the placeholder values to ensure the user has updated them.
    return environment.supabaseUrl !== 'YOUR_SUPABASE_URL' && environment.supabaseKey !== 'YOUR_SUPABASE_ANON_KEY';
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
      .channel('public:guestbook')
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
