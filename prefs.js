import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { getSettings } from './lib/settings.js';
import { lookupToken, storeToken, clearToken } from './lib/secrets.js';

function makeProviderRow({ title, provider }) {
  const group = new Adw.PreferencesGroup({ title });

  const statusRow = new Adw.ActionRow({ title: 'Token status', subtitle: 'Checking...' });
  group.add(statusRow);

  const entryRow = new Adw.ActionRow({ title: 'Token' });
  const entry = new Gtk.PasswordEntry({ hexpand: true, show_peek_icon: true });
  entryRow.add_suffix(entry);
  group.add(entryRow);

  const buttonsRow = new Adw.ActionRow({ title: 'Actions' });
  const saveBtn = new Gtk.Button({ label: 'Save' });
  const clearBtn = new Gtk.Button({ label: 'Clear' });
  buttonsRow.add_suffix(saveBtn);
  buttonsRow.add_suffix(clearBtn);
  group.add(buttonsRow);

  async function refreshStatus() {
    const tok = await lookupToken(provider);
    statusRow.subtitle = tok ? 'Configured' : 'Not configured';
  }

  saveBtn.connect('clicked', async () => {
    try {
      await storeToken(provider, entry.text);
      entry.text = '';
    } catch (e) {
    }
    await refreshStatus();
  });

  clearBtn.connect('clicked', async () => {
    try {
      await clearToken(provider);
    } catch (e) {
    }
    await refreshStatus();
  });

  refreshStatus();

  return group;
}

export default class AiUsagePrefs extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = getSettings();

    const page = new Adw.PreferencesPage();
    window.add(page);

    const general = new Adw.PreferencesGroup({ title: 'General' });
    page.add(general);

    const intervalRow = new Adw.ActionRow({ title: 'Poll interval (seconds)' });
    const spin = new Gtk.SpinButton({
      adjustment: new Gtk.Adjustment({ lower: 30, upper: 3600, step_increment: 10 }),
      numeric: true,
    });
    spin.value = settings.get_int('poll-interval-seconds');
    spin.connect('value-changed', () => settings.set_int('poll-interval-seconds', Math.round(spin.value)));
    intervalRow.add_suffix(spin);
    general.add(intervalRow);

    const codexGroup = makeProviderRow({ title: 'Codex', provider: 'codex' });
    const copilotGroup = makeProviderRow({ title: 'GitHub Copilot', provider: 'copilot' });
    page.add(codexGroup);
    page.add(copilotGroup);
  }
}
