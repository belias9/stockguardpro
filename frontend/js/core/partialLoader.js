class PartialLoader {
    constructor() { this.cache = new Map(); }

    async load(name) {
        if (this.cache.has(name)) return this.cache.get(name);
        const res = await fetch(`partials/${name}.html`);
        if (!res.ok) throw new Error(`Failed to load partial: ${name}`);
        const html = await res.text();
        this.cache.set(name, html);
        return html;
    }

    async inject(slotId, name) {
        const el = document.getElementById(slotId);
        if (!el) return;
        el.innerHTML = await this.load(name);
    }
}

const partials = new PartialLoader();