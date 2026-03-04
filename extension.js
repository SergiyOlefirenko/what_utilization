import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { getSettings } from './lib/settings.js';
import { lookupToken } from './lib/secrets.js';
import { requestJson } from './lib/http.js';
import { Poller } from './lib/poller.js';
import { formatPanelLabel } from './lib/format.js';
import { fetchCodexUsage } from './lib/providers/codex.js';
import { fetchCopilotUsage } from './lib/providers/copilot.js';

class AiUsageIndicator extends PanelMenu.Button {
  constructor() {
    super(0.0, 'AI Usage Indicator');

    this._label = new St.Label({
      text: formatPanelLabel(),
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

  updateState(snapshot) {
    const codex = snapshot?.codex ?? null;
    const copilot = snapshot?.copilot ?? null;

    const dailyPercent = codex?.ok ? codex.dailyPercent : null;
    const weeklyPercent = codex?.ok ? codex.weeklyPercent : null;
    const ghPercent = copilot?.ok ? copilot.usedPercent : null;

    this._label.text = formatPanelLabel({ ghPercent, dailyPercent, weeklyPercent });

    if (codex?.ok) {
      const nextReset = codex.windows?.map(w => w.resetAtMs).filter(x => Number.isFinite(x)).sort()[0] ?? null;
      const plan = codex.planType ?? 'unknown';
      this._codexItem.label.text = `Codex: ${plan}${nextReset ? ` (next reset: ${new Date(nextReset).toISOString().slice(0, 10)})` : ''}`;
    } else if (codex?.errorKind === 'not_configured') {
      this._codexItem.label.text = 'Codex: not configured';
    } else {
      this._codexItem.label.text = 'Codex: --';
    }

    if (copilot?.ok) {
      this._copilotItem.label.text = `Copilot: ${copilot.plan ?? 'unknown'}${copilot.resetDate ? ` (reset: ${copilot.resetDate})` : ''}`;
    } else if (copilot?.errorKind === 'not_configured') {
      this._copilotItem.label.text = 'Copilot: not configured';
    } else {
      this._copilotItem.label.text = 'Copilot: --';
    }
  }
}

export default class AiUsageExtension extends Extension {
  enable() {
    this._settings = getSettings();
    this._indicator = new AiUsageIndicator();
    Main.panel.addToStatusArea(this.uuid, this._indicator);

    const providers = {
      codex: ({ token, requestJson: rj }) => fetchCodexUsage({ token, requestJson: rj }),
      copilot: ({ token, requestJson: rj }) => fetchCopilotUsage({ token, requestJson: rj }),
    };

    this._poller = new Poller({
      providers,
      lookupToken: async (name) => lookupToken(name),
      requestJson,
      intervalSeconds: this._settings.get_int('poll-interval-seconds'),
      onUpdate: (name, result, snapshot) => this._indicator.updateState(snapshot),
      backoffBaseSeconds: 30,
    });

    this._settingsChangedId = this._settings.connect('changed', () => {
      const interval = this._settings.get_int('poll-interval-seconds');
      this._poller.setIntervalSeconds(interval);
    });

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
    this._settings = null;
  }
}
