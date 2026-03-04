import Gio from 'gi://Gio';
import ExtensionUtils from 'resource:///org/gnome/shell/misc/extensionUtils.js';

export const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.ai-usage';

export function getSettings() {
  try {
    return ExtensionUtils.getSettings(SETTINGS_SCHEMA);
  } catch (e) {
    return new Gio.Settings({ schema_id: SETTINGS_SCHEMA });
  }
}
