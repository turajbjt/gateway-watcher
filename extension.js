import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Pango from 'gi://Pango';
import Soup from 'gi://Soup?version=3.0';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const RSS_URL = 'http://www.gatewaystatus.com/rss.cgi';

const GatewayStatusIndicator = GObject.registerClass(
class GatewayStatusIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.5, 'Gateway Status');
        this._extension = extension;
        this._settings = extension.getSettings();
        this._lastStatusWasDown = false;
        this._isSnoozed = false;
        this._httpSession = new Soup.Session();

        this.icon = new St.Icon({ 
            icon_name: 'security-high-symbolic', 
            style_class: 'system-status-icon' 
        });
        this.add_child(this.icon);

        this._buildMenu();
        this._refreshStatus();
    }

    _buildMenu() {
        this.menu.removeAll();
        
        let topSection = new PopupMenu.PopupMenuSection();
        let refreshItem = new PopupMenu.PopupImageMenuItem('Refresh Now', 'view-refresh-symbolic');
        refreshItem.connect('activate', () => this._refreshStatus());
        topSection.addMenuItem(refreshItem);

        this._snoozeItem = new PopupMenu.PopupImageMenuItem('Snooze Alerts', 'alarm-symbolic');
        this._snoozeItem.connect('activate', () => {
            this._isSnoozed = !this._isSnoozed;
            this._refreshStatus();
        });
        topSection.addMenuItem(this._snoozeItem);
        this.menu.addMenuItem(topSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._statusItem = new PopupMenu.PopupMenuItem('Checking...');
        this._statusItem.add_style_class_name('gateway-status-label');
        this.menu.addMenuItem(this._statusItem);

        this._incidentSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._incidentSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let settingsItem = new PopupMenu.PopupImageMenuItem('Extension Settings', 'emblem-system-symbolic');
        settingsItem.connect('activate', () => this._extension.openPreferences());
        this.menu.addMenuItem(settingsItem);

        let webItem = new PopupMenu.PopupImageMenuItem('Open Website', 'action-unavailable-symbolic');
        webItem.connect('activate', () => Gio.app_info_launch_default_for_uri('http://www.gatewaystatus.com', null));
        this.menu.addMenuItem(webItem);
    }

    async _refreshStatus() {
        if (this._timeout) GLib.Source.remove(this._timeout);

        try {
            const message = Soup.Message.new('GET', RSS_URL);
            const bytes = await this._httpSession.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const xmlText = new TextDecoder().decode(bytes.get_data());

            const keywords = this._settings.get_string('track-keywords')
                .split(',').map(k => k.trim().toLowerCase()).filter(k => k);
            
            const items = xmlText.match(/<item>([\s\S]*?)<\/item>/g) || [];
            let trackedIssues = [];

            items.forEach(item => {
                const title = item.match(/<title>(.*?)<\/title>/)?.[1] || "Update";
                const desc = item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "";
                const isIssue = /Investigating|Identified|Outage|Degraded/i.test(title);
                const matchesKeyword = keywords.length === 0 || keywords.some(k => title.toLowerCase().includes(k));
                
                if (isIssue && matchesKeyword) trackedIssues.push({ title, desc });
            });

            this._updateUI(trackedIssues);
        } catch (e) {
            this._statusItem.label.set_text('📡 Connection Error');
            this.icon.style_class = 'status-dim-icon';
        }

        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._settings.get_int('check-interval'), () => {
            this._refreshStatus();
            return GLib.SOURCE_REMOVE;
        });
    }

    _updateUI(issues) {
        const isDown = issues.length > 0;
        
        if (this._isSnoozed && isDown) {
            this.icon.style_class = 'status-snooze-icon';
            this._statusItem.label.set_text('⚠️ Issues (Snoozed)');
        } else {
            this.icon.style_class = isDown ? 'status-red-icon' : 'status-green-icon';
            this._statusItem.label.set_text(isDown ? '⚠️ Issues Detected' : '✅ Systems Operational');
        }

        this._snoozeItem.label.set_text(this._isSnoozed ? 'Resume Alerts' : 'Snooze Alerts');
        this._incidentSection.removeAll();

        issues.slice(0, 5).forEach(issue => {
            let subMenu = new PopupMenu.PopupSubMenuMenuItem(issue.title);
            subMenu.add_style_class_name('gateway-incident-card');
            
            let cleanDesc = issue.desc.replace(/<\/?[^>]+(>|$)/g, " ").trim();
            let descItem = new PopupMenu.PopupMenuItem(cleanDesc);
            descItem.label.clutter_text.line_wrap = true;
            descItem.label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD;
            
            subMenu.menu.addMenuItem(descItem);
            this._incidentSection.addMenuItem(subMenu);
        });

        if (isDown && !this._lastStatusWasDown && !this._isSnoozed) {
            this._notify("Gateway Alert", issues[0].title);
        }
        this._lastStatusWasDown = isDown;
    }

    _notify(title, msg) {
        const source = new Main.MessageTray.Source('Gateway', 'security-high-symbolic');
        Main.messageTray.add(source);
        source.showNotification(new Main.MessageTray.Notification(source, title, msg));
    }

    destroy() {
        if (this._timeout) GLib.Source.remove(this._timeout);
        super.destroy();
    }
});

export default class GatewayWatcherExtension extends Extension {
    enable() {
        this._indicator = new GatewayStatusIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }
    disable() { this._indicator.destroy(); this._indicator = null; }
}
