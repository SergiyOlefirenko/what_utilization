import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { lookupToken, storeToken, clearToken } from './lib/secrets.js';
import { getCodexCliAuthFilePath, readCodexAuthState } from './lib/codexCliAuth.js';

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.ai-usage';

function makeTokenProviderRow({ title, provider, tokenTitle = 'Token' }) {
  const group = new Adw.PreferencesGroup({ title });

  const statusRow = new Adw.ActionRow({ title: 'Token status', subtitle: 'Checking...' });
  group.add(statusRow);

  const entryRow = new Adw.ActionRow({ title: tokenTitle });
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
      statusRow.subtitle = 'Keyring unavailable';
      return;
    }
    await refreshStatus();
  });

  clearBtn.connect('clicked', async () => {
    try {
      await clearToken(provider);
    } catch (e) {
      statusRow.subtitle = 'Keyring unavailable';
      return;
    }
    await refreshStatus();
  });

  refreshStatus();

  return group;
}

function makeCodexRow() {
  const group = new Adw.PreferencesGroup({ title: 'Codex' });
  const authFilePath = getCodexCliAuthFilePath();

  const statusRow = new Adw.ActionRow({ title: 'Authentication', subtitle: 'Checking...' });
  group.add(statusRow);

  const detailsRow = new Adw.ActionRow({
    title: 'Codex CLI',
    subtitle: `Run codex login in a terminal. This build reads ${authFilePath} when available.`,
  });
  group.add(detailsRow);

  const entryRow = new Adw.ActionRow({ title: 'Fallback token' });
  const entry = new Gtk.PasswordEntry({ hexpand: true, show_peek_icon: true });
  entryRow.add_suffix(entry);
  group.add(entryRow);

  const buttonsRow = new Adw.ActionRow({ title: 'Actions' });
  const saveBtn = new Gtk.Button({ label: 'Save fallback' });
  const clearBtn = new Gtk.Button({ label: 'Clear fallback' });
  const recheckBtn = new Gtk.Button({ label: 'Recheck' });
  buttonsRow.add_suffix(saveBtn);
  buttonsRow.add_suffix(clearBtn);
  buttonsRow.add_suffix(recheckBtn);
  group.add(buttonsRow);

  async function refreshStatus() {
    const state = await readCodexAuthState({ lookupFallbackToken: lookupToken });

    if (state.ok && state.source === 'cli') {
      statusRow.subtitle = 'Connected via Codex CLI';
      detailsRow.subtitle = state.path
        ? `Using ${state.path}.`
        : 'Using Codex CLI login.';
      return;
    }

    if (state.ok && state.source === 'fallback') {
      statusRow.subtitle = 'Connected via fallback token';
      detailsRow.subtitle = 'Codex CLI login is unavailable, so the saved fallback token is in use.';
      return;
    }

    if (state.errorKind === 'not_installed') {
      statusRow.subtitle = 'Codex CLI not installed';
      detailsRow.subtitle = 'Install Codex CLI or save a fallback token below.';
      return;
    }

    if (state.errorKind === 'not_found') {
      statusRow.subtitle = 'Codex CLI not logged in';
      detailsRow.subtitle = `Run codex login in a terminal, or save a fallback token below. Expected file: ${authFilePath}`;
      return;
    }

    if (state.errorKind === 'unsupported_auth_mode') {
      statusRow.subtitle = 'Codex CLI auth mode unsupported';
      detailsRow.subtitle = 'This build needs ChatGPT-based Codex login. API-key-only Codex auth will not work here.';
      return;
    }

    if (state.errorKind === 'not_logged_in') {
      statusRow.subtitle = 'Codex CLI login incomplete';
      detailsRow.subtitle = `Re-run codex login, or save a fallback token below. File: ${authFilePath}`;
      return;
    }

    statusRow.subtitle = 'Codex CLI auth unreadable';
    detailsRow.subtitle = `Could not read ${authFilePath}. You can re-run codex login or use a fallback token below.`;
  }

  saveBtn.connect('clicked', async () => {
    try {
      await storeToken('codex', entry.text);
      entry.text = '';
    } catch (e) {
      statusRow.subtitle = 'Keyring unavailable';
      return;
    }
    await refreshStatus();
  });

  clearBtn.connect('clicked', async () => {
    try {
      await clearToken('codex');
    } catch (e) {
      statusRow.subtitle = 'Keyring unavailable';
      return;
    }
    await refreshStatus();
  });

  recheckBtn.connect('clicked', () => {
    refreshStatus();
  });

  refreshStatus();

  return group;
}

export default class AiUsagePrefs extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings(SETTINGS_SCHEMA);

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

    const codexEnabledRow = new Adw.ActionRow({ title: 'Enable Codex polling' });
    const codexEnabledSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
    settings.bind('enable-codex', codexEnabledSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    codexEnabledRow.add_suffix(codexEnabledSwitch);
    codexEnabledRow.activatable_widget = codexEnabledSwitch;
    general.add(codexEnabledRow);

    const copilotEnabledRow = new Adw.ActionRow({ title: 'Enable GitHub Copilot polling' });
    const copilotEnabledSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
    settings.bind('enable-copilot', copilotEnabledSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    copilotEnabledRow.add_suffix(copilotEnabledSwitch);
    copilotEnabledRow.activatable_widget = copilotEnabledSwitch;
    general.add(copilotEnabledRow);

    const codexGroup = makeCodexRow();
    const copilotGroup = makeTokenProviderRow({ title: 'GitHub Copilot', provider: 'copilot' });
    page.add(codexGroup);
    page.add(copilotGroup);
  }
}
