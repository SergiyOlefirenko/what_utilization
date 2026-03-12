import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { lookupToken, storeToken, clearToken } from './lib/secrets.js';
import {
  buildCodexStatus,
  canOpenUris,
  clearCodexAuth,
  loadCodexAuth,
  openCodexVerificationUrl,
  startCodexBrowserLogin,
} from './lib/codexAuth.js';

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
  const statusRow = new Adw.ActionRow({ title: 'Authentication', subtitle: 'Checking...' });
  group.add(statusRow);

  const detailsRow = new Adw.ActionRow({
    title: 'OpenAI login',
    subtitle: 'Click Sign in to open your browser and approve OpenAI access.',
  });
  group.add(detailsRow);

  const browserRow = new Adw.ActionRow({ title: 'Browser status', subtitle: 'Idle' });
  group.add(browserRow);

  const buttonsRow = new Adw.ActionRow({ title: 'Actions' });
  const signInBtn = new Gtk.Button({ label: 'Sign in' });
  const openBrowserBtn = new Gtk.Button({ label: 'Open browser' });
  const cancelBtn = new Gtk.Button({ label: 'Cancel' });
  const signOutBtn = new Gtk.Button({ label: 'Sign out' });
  buttonsRow.add_suffix(signInBtn);
  buttonsRow.add_suffix(openBrowserBtn);
  buttonsRow.add_suffix(cancelBtn);
  buttonsRow.add_suffix(signOutBtn);
  group.add(buttonsRow);

  let pendingLogin = null;

  function cancelPendingLogin() {
    pendingLogin?.cancel?.();
    pendingLogin = null;
  }

  function updateActionState(hasAuth) {
    const pending = pendingLogin !== null;
    signInBtn.sensitive = !pending;
    openBrowserBtn.sensitive = pending && canOpenUris();
    cancelBtn.sensitive = pending;
    signOutBtn.sensitive = hasAuth;
  }

  function describeError(result, fallback) {
    if (!result)
      return fallback;
    if (result.errorMessage)
      return result.errorMessage;
    if (result.description)
      return result.description;
    if (result.errorKind === 'network')
      return 'Network error while talking to OpenAI.';
    if (result.errorKind === 'unsupported')
      return 'OpenAI login is not enabled for this auth server.';
    if (result.errorKind === 'parse')
      return 'OpenAI auth returned an unexpected response.';
    if (result.errorKind === 'auth')
      return 'Authentication failed. Please sign in again.';
    if (result.errorKind === 'cancelled')
      return 'Browser login cancelled';
    if (result.errorKind === 'http')
      return Number.isFinite(result.status) ? `OpenAI auth failed with HTTP ${result.status}.` : fallback;
    return fallback;
  }

  async function refreshStatus(statusMessage = null) {
    const auth = await loadCodexAuth();

    if (pendingLogin) {
      statusRow.subtitle = statusMessage ?? 'Waiting for browser confirmation';
      detailsRow.subtitle = 'Finish the OpenAI approval flow in your browser. If no browser opened, press Open browser.';
      browserRow.subtitle = pendingLogin.authUrl;
      updateActionState(Boolean(auth));
      return;
    }

    if (auth) {
      statusRow.subtitle = statusMessage ?? buildCodexStatus(auth);
      detailsRow.subtitle = 'Connected with OpenAI browser login. Tokens are stored securely in the system keyring.';
      browserRow.subtitle = 'Idle';
      updateActionState(true);
      return;
    }

    statusRow.subtitle = statusMessage ?? 'Not connected';
    detailsRow.subtitle = 'Click Sign in to open your browser and approve OpenAI access.';
    browserRow.subtitle = 'Idle';
    updateActionState(false);
  }

  signInBtn.connect('clicked', async () => {
    cancelPendingLogin();
    await refreshStatus('Starting browser login...');

    const session = startCodexBrowserLogin();
    if (!session.ok) {
      await refreshStatus(describeError(session, 'Could not start OpenAI browser login.'));
      return;
    }

    pendingLogin = session;
    try {
      if (canOpenUris())
        openCodexVerificationUrl(session.authUrl);
    } catch (e) {
    }

    await refreshStatus();

    session.completion.then(async (result) => {
      if (pendingLogin !== session)
        return;

      pendingLogin = null;
      if (result.ok) {
        await refreshStatus('Connected');
        return;
      }

      await refreshStatus(describeError(result, 'Could not complete OpenAI browser login.'));
    });
  });

  openBrowserBtn.connect('clicked', () => {
    if (!pendingLogin)
      return;
    try {
      openCodexVerificationUrl(pendingLogin.authUrl);
    } catch (e) {
      statusRow.subtitle = 'Could not open browser';
    }
  });

  cancelBtn.connect('clicked', async () => {
    cancelPendingLogin();
    await refreshStatus('Browser login cancelled');
  });

  signOutBtn.connect('clicked', async () => {
    cancelPendingLogin();
    try {
      await clearCodexAuth();
    } catch (e) {
      statusRow.subtitle = 'Keyring unavailable';
      return;
    }
    await refreshStatus('Signed out');
  });

  group.connect('destroy', () => {
    cancelPendingLogin();
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
