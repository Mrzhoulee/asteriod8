const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const mm = require("music-metadata");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { Storage } = require("@google-cloud/storage");

const storage = new Storage();

// Initialize Firebase Admin (only if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}

// Mood mapping for user interface moods to analyzed moods
const moodMap = {
  Lonely: ["calm", "chill"],
  Rain: ["calm", "chill"],
  Late: ["chill"],
  Focus: ["focus"],
  Calm: ["calm"],
  Party: ["party", "energetic"],
  Holiday: ["party", "energetic", "chill"],
  Beach: ["chill", "party"],
  InThePlane: ["calm", "chill"],
  MorningDrive: ["energetic", "focus"],
  LateDrive: ["chill"],
  Mad: ["energetic"],
  Tired: ["calm", "chill"],
  Productive: ["focus"],
  Excited: ["energetic", "party"]
};

exports.analyzeSongMood = onObjectFinalized(
  { region: "northamerica-northeast1" },
  async (event) => {
    console.log("🔥 Function triggered!");
    const object = event.data;
    const filePath = object.name;
    console.log("🎵 Analyzing file:", filePath);

    if (!filePath || !filePath.endsWith(".mp3")) {
      console.log("❌ Not an MP3 file, skipping");
      return;
    }

    console.log("📥 Downloading file...");
    const bucket = storage.bucket(object.bucket);
    const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));

    await bucket.file(filePath).download({ destination: tempFilePath });
    console.log("✅ File downloaded to:", tempFilePath);

    console.log("🎼 Parsing metadata...");
    const metadata = await mm.parseFile(tempFilePath);
    const duration = metadata.format.duration || 0;
    const bitrate = metadata.format.bitrate || 0;
    console.log("📊 Duration:", duration, "seconds, Bitrate:", bitrate);

    let mood = "focus";
    if (duration > 240 && bitrate < 180000) mood = "chill";
    if (duration < 180 && bitrate > 220000) mood = "energetic";
    if (duration > 300) mood = "calm";
    if (bitrate > 260000) mood = "party";

    console.log("🎭 Determined mood:", mood);

    // Find which user moods this analyzed mood matches
    const matchingUserMoods = Object.entries(moodMap)
      .filter(([userMood, analyzedMoods]) => analyzedMoods.includes(mood))
      .map(([userMood]) => userMood);

    console.log("👥 Matching user moods:", matchingUserMoods.join(", "));

    // For now, just save to file metadata instead of Firestore
    console.log("💾 Saving metadata to file...");
    await bucket.file(filePath).setMetadata({
      metadata: {
        autoMood: mood,
        userMoods: matchingUserMoods.join(","),
        analyzed: "true",
        duration: duration.toString(),
        bitrate: bitrate.toString()
      }
    });
    console.log("✅ Metadata saved");

    fs.unlinkSync(tempFilePath);
    console.log("🗑️ Cleaned up temp file");
    console.log("🎉 Analysis complete! Mood:", mood);
  }
);

exports.getSongsByMood = onRequest(
  { region: "northamerica-northeast1", cors: true },
  async (req, res) => {
    console.log("🔍 Searching for songs by mood...");
    const moodQuery = req.query.mood;

    if (!moodQuery) {
      console.log("❌ Missing mood parameter");
      return res.status(400).json({ error: "Missing mood parameter. Use ?mood=focus or ?mood=chill,energetic" });
    }

    const moods = moodQuery.split(",");
    console.log("🎯 Searching for moods:", moods);

    const bucket = storage.bucket("asteroid-cdc13.appspot.com");
    const [files] = await bucket.getFiles();

    const results = [];
    let processedCount = 0;

    for (const file of files) {
      if (!file.name.endsWith(".mp3")) continue;

      try {
        const [metadata] = await file.getMetadata();
        const autoMood = metadata.metadata?.autoMood;
        const userMoods = metadata.metadata?.userMoods?.split(",") || [];

        // Check if the song's mood matches any of the requested moods
        if (autoMood && moods.includes(autoMood)) {
          results.push({
            name: file.name,
            mood: autoMood,
            userMoods: userMoods,
            path: file.name,
            size: metadata.size,
            updated: metadata.updated
          });
        }
        processedCount++;
      } catch (error) {
        console.log("⚠️ Error processing file:", file.name, error.message);
      }
    }

    console.log("✅ Found", results.length, "songs out of", processedCount, "processed files");
    res.json({
      query: moodQuery,
      results: results,
      totalFound: results.length,
      totalProcessed: processedCount
    });
  }
);

// Function to analyze all existing songs
exports.analyzeAllExistingSongs = onRequest(
  { region: "northamerica-northeast1", cors: true },
  async (req, res) => {
    console.log("🔄 Starting batch analysis of all existing songs...");

    const bucket = storage.bucket("asteroid-cdc13.appspot.com");
    const [files] = await bucket.getFiles();

    let analyzedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results = [];

    console.log(`📁 Found ${files.length} total files in storage`);

    for (const file of files) {
      if (!file.name.endsWith(".mp3")) continue;

      try {
        // Check if already analyzed
        const [metadata] = await file.getMetadata();
        const existingMood = metadata.metadata?.autoMood;

        if (existingMood) {
          console.log(`⏭️ Skipping already analyzed: ${file.name}`);
          skippedCount++;
          continue;
        }

        console.log(`🎵 Analyzing: ${file.name}`);
        analyzedCount++;

        // Download and analyze the file
        const tempFilePath = path.join(os.tmpdir(), `batch_${path.basename(file.name)}`);
        await bucket.file(file.name).download({ destination: tempFilePath });

        const metadata_result = await mm.parseFile(tempFilePath);
        const duration = metadata_result.format.duration || 0;
        const bitrate = metadata_result.format.bitrate || 0;

        // Determine mood
        let mood = "focus";
        if (duration > 240 && bitrate < 180000) mood = "chill";
        if (duration < 180 && bitrate > 220000) mood = "energetic";
        if (duration > 300) mood = "calm";
        if (bitrate > 260000) mood = "party";

        // Find matching user moods
        const matchingUserMoods = Object.entries(moodMap)
          .filter(([userMood, analyzedMoods]) => analyzedMoods.includes(mood))
          .map(([userMood]) => userMood);

        // Save metadata
        await bucket.file(file.name).setMetadata({
          metadata: {
            autoMood: mood,
            userMoods: matchingUserMoods.join(","),
            analyzed: "true",
            duration: duration.toString(),
            bitrate: bitrate.toString(),
            batchAnalyzed: "true"
          }
        });

        // Clean up temp file
        fs.unlinkSync(tempFilePath);

        results.push({
          name: file.name,
          mood: mood,
          userMoods: matchingUserMoods,
          duration: duration,
          bitrate: bitrate
        });

        console.log(`✅ Analyzed: ${file.name} → ${mood}`);

      } catch (error) {
        console.error(`❌ Error analyzing ${file.name}:`, error.message);
        errorCount++;
      }
    }

    console.log(`🎉 Batch analysis complete!`);
    console.log(`📊 Results: ${analyzedCount} analyzed, ${skippedCount} skipped, ${errorCount} errors`);

    res.json({
      success: true,
      analyzed: analyzedCount,
      skipped: skippedCount,
      errors: errorCount,
      totalProcessed: analyzedCount + skippedCount + errorCount,
      newSongs: results
    });
  }
);
