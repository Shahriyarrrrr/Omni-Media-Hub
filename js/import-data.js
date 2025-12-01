// import-data.js — Omni Media Hub Data Auto-Importer
// Loads JSON from /data/*.json and populates localStorage safely
// @ts-nocheck

(async function () {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    // Confirm user wants import
    if (!confirm("Load Omni Media Hub demo data into your system?")) {
        console.log("Importer canceled.");
        return;
    }

    const fetchSafely = async (file, fallback = []) => {
        try {
            const res = await fetch(file);
            if (!res.ok) throw new Error("Fetch failed");
            return await res.json();
        } catch (err) {
            console.warn("Could not load:", file);
            return fallback;
        }
    };

    // LOAD ALL JSON FILES
    const movies    = await fetchSafely("data/movies.json", []);
    const music     = await fetchSafely("data/music.json", []);
    const artists   = await fetchSafely("data/artists.json", []);
    const playlists = await fetchSafely("data/playlists.json", []);
    const genres    = await fetchSafely("data/genres.json", []);
    const trending  = await fetchSafely("data/trending.json", { movies: [], music: [] });

    // CLEAN + NORMALIZE DATA
    const normalize = (item) => ({
        id: item.id ?? crypto.randomUUID(),
        type: item.type ?? "unknown",
        title: item.title ?? item.name ?? "Untitled",
        name: item.name ?? item.title ?? "Unknown",
        year: item.year ?? "",
        artist: item.artist ?? "",
        album: item.album ?? "",
        genre: item.genre ?? "Misc",
        description: item.description ?? "",
        cover: item.cover ?? "",
        poster: item.poster ?? "",
        image: item.image ?? "",
        src: item.src ?? "",
        tracks: item.tracks ?? [],
        duration: item.duration ?? 0
    });

    const cleanMovies    = movies.map(normalize);
    const cleanMusic     = music.map(normalize);
    const cleanArtists   = artists.map(normalize);
    const cleanPlaylists = playlists.map(normalize);
    const cleanGenres    = genres.map(g => ({ name: g.name, color: g.color || "#8be7ff" }));

    // WRITE INTO LOCALSTORAGE
    try {
        localStorage.setItem("omni_movies", JSON.stringify(cleanMovies));
        localStorage.setItem("omni_music", JSON.stringify(cleanMusic));
        localStorage.setItem("omni_artists", JSON.stringify(cleanArtists));
        localStorage.setItem("omni_playlists", JSON.stringify(cleanPlaylists));
        localStorage.setItem("omni_genres", JSON.stringify(cleanGenres));
        localStorage.setItem("omni_trending", JSON.stringify(trending));

        // Ensure session or first-time indicator exists
        if (!localStorage.getItem("omni_settings")) {
            localStorage.setItem("omni_settings", JSON.stringify({ theme: "dark", quality: "high" }));
        }

        alert("Omni Media Hub data imported successfully!");
        console.log("Import complete.")

    } catch (err) {
        console.error("Error writing to localStorage:", err);
        alert("Import failed — check console.");
    }

})();
