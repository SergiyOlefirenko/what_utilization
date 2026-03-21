import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { lookupToken } from './lib/secrets.js';
import { lookupCodexAccessToken } from './lib/codexAuth.js';
import { requestJson, requestText } from './lib/http.js';
import { Poller } from './lib/poller.js';
import { formatPanelLabel, formatCopilotUsage, formatCodexUsage } from './lib/format.js';
import { fetchCodexUsage } from './lib/providers/codex.js';
import { fetchCopilotUsage } from './lib/providers/copilot.js';
import { formatCodexStatus, formatCopilotStatus } from './lib/providerStatus.js';

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.ai-usage';
const PANEL_ICON_SIZE = 14;
const MENU_ICON_SIZE = 16;

function createIcon(iconPath, iconSize, styleClass = null) {
  const file = Gio.File.new_for_path(iconPath);
  const props = {
    gicon: new Gio.FileIcon({ file }),
    icon_size: iconSize,
    y_align: Clutter.ActorAlign.CENTER,
    style: 'color: #ffffff;',
  };

  if (styleClass)
    props.style_class = styleClass;

  return new St.Icon(props);
}

function createPanelProviderItem(iconPath) {
  const box = new St.BoxLayout({
    y_align: Clutter.ActorAlign.CENTER,
    style: 'spacing: 4px;',
  });
  const icon = createIcon(iconPath, PANEL_ICON_SIZE, 'system-status-icon');
  const label = new St.Label({ y_align: Clutter.ActorAlign.CENTER });
  box.add_child(icon);
  box.add_child(label);
  return { box, label };
}

function createMenuProviderItem(iconPath, text) {
  const item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
  const icon = createIcon(iconPath, MENU_ICON_SIZE);
  const label = new St.Label({
    text,
    x_expand: true,
    y_align: Clutter.ActorAlign.CENTER,
  });
  item.add_child(icon);
  item.add_child(label);
  return { item, label };
}

const AiUsageIndicator = GObject.registerClass(
class AiUsageIndicator extends PanelMenu.Button {
  constructor(iconPaths, enabled = { codex: true, copilot: true }) {
    super(0.0, 'AI Usage Indicator');

    this._panelBox = new St.BoxLayout({
      y_align: Clutter.ActorAlign.CENTER,
      style: 'spacing: 8px;',
    });
    this.add_child(this._panelBox);

    this._copilotPanel = createPanelProviderItem(iconPaths.copilot);
    this._codexPanel = createPanelProviderItem(iconPaths.codex);
    this._emptyLabel = new St.Label({
      text: formatPanelLabel({ showGh: false, showCodex: false }),
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._panelBox.add_child(this._copilotPanel.box);
    this._panelBox.add_child(this._codexPanel.box);
    this._panelBox.add_child(this._emptyLabel);

    this._menuHeader = new PopupMenu.PopupMenuItem('AI Usage', { reactive: false });
    this.menu.addMenuItem(this._menuHeader);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this._codexMenu = createMenuProviderItem(iconPaths.codex, 'Codex: --');
    this._copilotMenu = createMenuProviderItem(iconPaths.copilot, 'Copilot: --');
    this.menu.addMenuItem(this._codexMenu.item);
    this.menu.addMenuItem(this._copilotMenu.item);

    this.updateState({}, enabled);
  }

  updateState(snapshot, enabled = { codex: true, copilot: true }) {
    const codex = snapshot?.codex ?? null;
    const copilot = snapshot?.copilot ?? null;

    const dailyPercent = enabled.codex && codex?.ok ? codex.dailyPercent : null;
    const weeklyPercent = enabled.codex && codex?.ok ? codex.weeklyPercent : null;
    const ghPercent = enabled.copilot && copilot?.ok ? copilot.remainingPercent : null;

    this._copilotPanel.label.text = formatCopilotUsage(ghPercent);
    this._codexPanel.label.text = formatCodexUsage({ dailyPercent, weeklyPercent });
    this._copilotPanel.box.visible = enabled.copilot;
    this._codexPanel.box.visible = enabled.codex;
    this._emptyLabel.visible = !enabled.copilot && !enabled.codex;

    this._codexMenu.label.text = formatCodexStatus(codex, enabled.codex);
    this._copilotMenu.label.text = formatCopilotStatus(copilot, enabled.copilot);
    this._codexMenu.item.visible = enabled.codex;
    this._copilotMenu.item.visible = enabled.copilot;
  }
});

export default class AiUsageExtension extends Extension {
  enable() {
    this._settings = this.getSettings(SETTINGS_SCHEMA);
    this._providerEnabled = this._readProviderEnabled();
    this._indicator = new AiUsageIndicator(this._buildIconPaths(), this._providerEnabled);
    Main.panel.addToStatusArea(this.uuid, this._indicator);

    this._poller = new Poller({
      providers: this._buildProviders(),
      lookupToken: async (name) => {
        if (name === 'codex')
          return lookupCodexAccessToken({ requestTextFn: requestText });
        return lookupToken(name);
      },
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

  _buildIconPaths() {
    return {
      codex: `${this.path}/assets/icons/providers/codex-symbolic.svg`,
      copilot: `${this.path}/assets/icons/providers/githubcopilot-symbolic.svg`,
    };
  }

  _buildProviders() {
    const providers = {};
    if (this._providerEnabled?.codex) {
      providers.codex = ({ token, requestJson: rj, cancellable }) => fetchCodexUsage({
        token,
        requestJson: rj,
        requestTextFn: requestText,
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
