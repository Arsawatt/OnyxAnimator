class BrushManager {
    constructor() {
        this.brushes = [];
        this.selectedBrush = null;
    }

    async loadBrushes() {
        const list = [
            { name: "Soft Round", path: "brushes/soft.png", type: "default" },
            { name: "Hard Round", path: "brushes/hard.png", type: "default" },
            { name: "Pencil", path: "brushes/pencil.png", type: "default" },
        ];

        // Load all PNG brushes automatically
        const response = await fetch("brushes/");
        const html = await response.text();

        const pngs = [...html.matchAll(/href="([^"]+\.png)"/g)].map(m => m[1]);

        pngs.forEach(p => {
            if (!list.some(x => x.path === "brushes/" + p)) {
                list.push({ name: p.replace(".png",""), path: "brushes/" + p, type: "alpha" });
            }
        });

        for (let item of list) {
            const img = new Image();
            img.src = item.path;
            await img.decode();

            this.brushes.push({
                name: item.name,
                image: img,
                type: item.type
            });
        }

        this.selectedBrush = this.brushes[0];
    }
}

window.BrushManager = new BrushManager();
