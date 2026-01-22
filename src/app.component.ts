import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { SupabaseService } from './services/supabase.service';
import { GuestbookEntry } from './types/guestbook.types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  // FIX: Explicitly specify the type of `fb` to `FormBuilder` to resolve a type inference issue where it was being inferred as `unknown`.
  private fb: FormBuilder = inject(FormBuilder);

  entries = signal<GuestbookEntry[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  formError = signal<string | null>(null);
  submitting = signal<boolean>(false);
  isDarkMode = signal<boolean>(false);
  
  guestbookForm: FormGroup;

  constructor() {
    this.guestbookForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(50)]],
      message: ['', [Validators.required, Validators.maxLength(500)]],
    });
  }

  ngOnInit(): void {
    this.initializeDarkMode();
    this.fetchEntries();
    this.listenToNewEntries();
  }

  initializeDarkMode(): void {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      this.isDarkMode.set(storedTheme === 'dark');
    } else {
      this.isDarkMode.set(prefersDark);
    }
    this.applyTheme();
  }

  toggleDarkMode(): void {
    this.isDarkMode.update(value => !value);
    localStorage.setItem('theme', this.isDarkMode() ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme(): void {
    if (this.isDarkMode()) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  async fetchEntries(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    if (!this.supabaseService.isConfigured()) {
      this.error.set('Supabase is not configured. Please add your URL and Key in src/environments/environment.ts');
      this.loading.set(false);
      return;
    }

    try {
      const { data, error } = await this.supabaseService.getGuestbookEntries();
      if (error) {
        throw error;
      }
      this.entries.set(data || []);
    } catch (e: any) {
      console.error('Error fetching entries:', e);
      this.error.set(`Failed to load guestbook entries: ${e.message}`);
    } finally {
      this.loading.set(false);
    }
  }
  
  listenToNewEntries(): void {
    if (!this.supabaseService.isConfigured()) return;

    this.supabaseService.listenToGuestbookChanges((newEntry) => {
        // Add the new entry to the top of the list, preventing duplicates.
        this.entries.update(currentEntries => {
          const entryExists = currentEntries.some(e => e.id === newEntry.id);
          return entryExists ? currentEntries : [newEntry, ...currentEntries];
        });
    });
  }

  async onSubmit(): Promise<void> {
    if (this.guestbookForm.invalid) {
      this.guestbookForm.markAllAsTouched();
      this.formError.set('Please fill out all fields correctly.');
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);

    const { name, message } = this.guestbookForm.value;

    try {
      const { data, error } = await this.supabaseService.addGuestbookEntry(name, message);
      if (error) {
        throw error;
      }
      if (data && data.length > 0) {
        // Optimistically update the UI, but the real-time listener will also catch this.
        // The duplicate check in the listener prevents adding it twice.
        this.entries.update(currentEntries => [data[0], ...currentEntries]);
      }
      this.guestbookForm.reset();
    } catch (e: any) {
      console.error('Error adding entry:', e);
      let errorMessage = `Failed to submit your message: ${e.message}`;
      // Provide a more specific error message for RLS policy failures
      if (e.message && e.message.includes('violates row-level security policy')) {
        errorMessage = 'Failed to save message. Please check that the INSERT Row Level Security (RLS) policy is correctly configured for the "public" role on your Supabase "guestbook" table. The "WITH CHECK" expression should simply be "true".';
      }
      this.formError.set(errorMessage);
    } finally {
      this.submitting.set(false);
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}
