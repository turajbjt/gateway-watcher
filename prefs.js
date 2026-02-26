import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GatewayWatcherPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({ 
            title: 'Monitoring Settings' 
        });
        page.add(group);

        // SpinRow (supports title and subtitle)
        const intervalRow = new Adw.SpinRow({
            title: 'Check Interval (seconds)',
            subtitle: 'How often to poll the RSS feed',
            adjustment: new Gtk.Adjustment({ 
                lower: 60, 
                upper: 3600, 
                step_increment: 10, 
                page_increment: 60 
            }),
        });
        settings.bind('check-interval', intervalRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(intervalRow);

        // EntryRow (supports title, but NOT description)
        const keywordRow = new Adw.EntryRow({
            title: 'Tracked Keywords (e.g. API, Web)',
        });
        settings.bind('track-keywords', keywordRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        group.add(keywordRow);

        window.add(page);
    }
}
