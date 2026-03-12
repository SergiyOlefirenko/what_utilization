import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { lookupToken } from './lib/secrets.js';
import { requestJson } from './lib/http.js';
import { Poller } from './lib/poller.js';
import { formatPanelLabel } from './lib/format.js';
import { fetchCodexUsage } from './lib/providers/codex.js';
import { fetchCopilotUsage } from './lib/providers/copilot.js';
import { formatCodexStatus, formatCopilotStatus } from './lib/providerStatus.js';

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.ai-usage';

const AiUsageIndicator = GObject.registerClass(
class AiUsageIndicator extends PanelMenu.Button {
  constructor(enabled = { codex: true, copilot: true }) {
    super(0.0, 'AI Usage Indicator');

    this._label = new St.Label({
      text: formatPanelLabel({
        showGh: enabled.copilot,
        showDaily: enabled.codex,
        showWeekly: enabled.codex,
      }),
      y_align: Clutter.ActorAlign.CENTER,
    });
    this.add_child(this._label);

    this._menuHeader = new PopupMenu.PopupMenuItem('AI Usage', { reactive: false });
    this.menu.addMenuItem(this._menuHeader);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this._codexItem = new PopupMenu.PopupMenuItem('Codex: --', { reactive: false });
    this._copilotItem = new PopupMenu.PopupMenuItem('Copilot: --', { reactive: false });
    this.menu.addMenuItem(this._codexItem);
    this.menu.addMenuItem(this._copilotItem);
  }

  updateState(snapshot, enabled = { codex: true, copilot: true }) {
    const codex = snapshot?.codex ?? null;
    const copilot = snapshot?.copilot ?? null;

    const dailyPercent = enabled.codex && codex?.ok ? codex.dailyPercent : null;
    const weeklyPercent = enabled.codex && codex?.ok ? codex.weeklyPercent : null;
    const ghPercent = enabled.copilot && copilot?.ok ? copilot.remainingPercent : null;

    this._label.text = formatPanelLabel({
      ghPercent,
      dailyPercent,
      weeklyPercent,
      showGh: enabled.copilot,
      showDaily: enabled.codex,
      showWeekly: enabled.codex,
    });
    this._codexItem.label.text = formatCodexStatus(codex, enabled.codex);
    this._copilotItem.label.text = formatCopilotStatus(copilot, enabled.copilot);
  }
});

export default class AiUsageExtension extends Extension {
  enable() {
    this._settings = this.getSettings(SETTINGS_SCHEMA);
    this._providerEnabled = this._readProviderEnabled();
    this._indicator = new AiUsageIndicator(this._providerEnabled);
    Main.panel.addToStatusArea(this.uuid, this._indicator);

    this._poller = new Poller({
      providers: this._buildProviders(),
      lookupToken: async (name) => lookupToken(name),
      requestJson,
      intervalSeconds: this._settings.get_int('poll-interval-seconds'),
      onUpdate: (name, result, snapshot) => this._indicator.updateState(snapshot, this._providerEnabled),
      backoffBaseSeconds: 30,
    });

    this._settingsChangedId = this._settings.connect('changed', () => {
      const interval = this._settings.get_int('poll-interval-seconds');
      this._providerEnabled = this._readProviderEnabled();
      this._poller.setIntervalSeconds(interval);
      this._poller.setProviders(this._buildProviders());
      this._indicator.updateState(this._poller.snapshot, this._providerEnabled);
    });

    this._indicator.updateState(this._poller.snapshot, this._providerEnabled);
    this._poller.start();
  }

  disable() {
    if (this._settings && this._settingsChangedId) {
      this._settings.disconnect(this._settingsChangedId);
      this._settingsChangedId = 0;
    }

    this._poller?.stop();
    this._poller = null;

    this._indicator?.destroy();
    this._indicator = null;
    this._providerEnabled = null;
    this._settings = null;
  }

  _readProviderEnabled() {
    return {
      codex: this._settings.get_boolean('enable-codex'),
      copilot: this._settings.get_boolean('enable-copilot'),
    };
  }

  _buildProviders() {
    const providers = {};
    if (this._providerEnabled?.codex) {
      providers.codex = ({ token, requestJson: rj, cancellable }) => fetchCodexUsage({
        token,
        requestJson: rj,
        cancellable,
      });
    }
    if (this._providerEnabled?.copilot) {
      providers.copilot = ({ token, requestJson: rj, cancellable }) => fetchCopilotUsage({
        token,
        requestJson: rj,
        cancellable,
      });
    }
    return providers;
  }
}
