//! WAD file parser for extracting level names from MAPINFO lumps.
//!
//! WAD format:
//! - Header: 4 bytes sig ("IWAD"/"PWAD"), 4 bytes numlumps, 4 bytes diroffset
//! - Lumps: raw data
//! - Directory: entries of (4 bytes offset, 4 bytes size, 8 bytes name)

use regex::Regex;
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

/// A lump entry from the WAD directory
struct LumpEntry {
    offset: u32,
    size: u32,
    name: String,
}

/// Parse a WAD file and extract level names from MAPINFO/ZMAPINFO/UMAPINFO/DEHACKED
pub fn extract_level_names<P: AsRef<Path>>(wad_path: P) -> Result<HashMap<String, String>, String> {
    let path = wad_path.as_ref();
    let mut file = File::open(path).map_err(|e| format!("Failed to open WAD: {}", e))?;

    // Read header
    let mut header = [0u8; 12];
    file.read_exact(&mut header)
        .map_err(|e| format!("Failed to read WAD header: {}", e))?;

    let sig = String::from_utf8_lossy(&header[0..4]);
    if sig != "IWAD" && sig != "PWAD" {
        return Err(format!("Invalid WAD signature: {}", sig));
    }

    let numlumps = u32::from_le_bytes([header[4], header[5], header[6], header[7]]);
    let diroffset = u32::from_le_bytes([header[8], header[9], header[10], header[11]]);

    // Read directory
    file.seek(SeekFrom::Start(diroffset as u64))
        .map_err(|e| format!("Failed to seek to directory: {}", e))?;

    let mut lumps = Vec::with_capacity(numlumps as usize);
    for _ in 0..numlumps {
        let mut entry = [0u8; 16];
        file.read_exact(&mut entry)
            .map_err(|e| format!("Failed to read lump entry: {}", e))?;

        let offset = u32::from_le_bytes([entry[0], entry[1], entry[2], entry[3]]);
        let size = u32::from_le_bytes([entry[4], entry[5], entry[6], entry[7]]);
        let name = String::from_utf8_lossy(&entry[8..16])
            .trim_end_matches('\0')
            .to_uppercase();

        lumps.push(LumpEntry { offset, size, name });
    }

    // Look for MAPINFO lumps (in priority: ZMAPINFO, UMAPINFO, MAPINFO)
    let mut level_names: HashMap<String, String> = HashMap::new();

    // Try ZMAPINFO first (GZDoom extended format)
    if let Some(lump) = lumps.iter().find(|l| l.name == "ZMAPINFO") {
        let content = read_lump_content(&mut file, lump)?;
        parse_mapinfo(&content, &mut level_names);
    }

    // Then UMAPINFO (universal format)
    if let Some(lump) = lumps.iter().find(|l| l.name == "UMAPINFO") {
        let content = read_lump_content(&mut file, lump)?;
        parse_umapinfo(&content, &mut level_names);
    }

    // Then regular MAPINFO
    if let Some(lump) = lumps.iter().find(|l| l.name == "MAPINFO") {
        let content = read_lump_content(&mut file, lump)?;
        parse_mapinfo(&content, &mut level_names);
    }

    // Finally DEHACKED for classic WADs
    if let Some(lump) = lumps.iter().find(|l| l.name == "DEHACKED") {
        let content = read_lump_content(&mut file, lump)?;
        parse_dehacked(&content, &mut level_names);
    }

    Ok(level_names)
}

fn read_lump_content(file: &mut File, lump: &LumpEntry) -> Result<String, String> {
    file.seek(SeekFrom::Start(lump.offset as u64))
        .map_err(|e| format!("Failed to seek to lump: {}", e))?;

    let mut buffer = vec![0u8; lump.size as usize];
    file.read_exact(&mut buffer)
        .map_err(|e| format!("Failed to read lump content: {}", e))?;

    Ok(String::from_utf8_lossy(&buffer).to_string())
}

/// Parse MAPINFO/ZMAPINFO format
/// Looks for: map MAP01 "Level Name" or map MAP01 lookup "HUSTR_1"
fn parse_mapinfo(content: &str, names: &mut HashMap<String, String>) {
    // Pattern: map MAP01 "Level Name" or map E1M1 "Level Name"
    // Also handles: map MAP01 lookup "HUSTR_E1M1"
    let re = Regex::new(r#"(?i)^\s*map\s+(MAP\d+|E\d+M\d+)\s+"([^"]+)""#).unwrap();

    for line in content.lines() {
        if let Some(caps) = re.captures(line) {
            let map_id = caps.get(1).unwrap().as_str().to_uppercase();
            let map_name = caps.get(2).unwrap().as_str().to_string();

            // Skip if it's a lookup reference
            if !map_name.starts_with("HUSTR") && !map_name.starts_with("$") {
                names.entry(map_id).or_insert(map_name);
            }
        }
    }

    // Also try block format: map MAP01 { levelname = "Level Name" }
    let block_re =
        Regex::new(r#"(?i)map\s+(MAP\d+|E\d+M\d+)\s*\{([^}]*)\}"#).unwrap();
    let name_re = Regex::new(r#"(?i)levelname\s*=\s*"([^"]+)""#).unwrap();

    for caps in block_re.captures_iter(content) {
        let map_id = caps.get(1).unwrap().as_str().to_uppercase();
        let block = caps.get(2).unwrap().as_str();

        if let Some(name_caps) = name_re.captures(block) {
            let map_name = name_caps.get(1).unwrap().as_str().to_string();
            if !map_name.starts_with("$") {
                names.entry(map_id).or_insert(map_name);
            }
        }
    }
}

/// Parse UMAPINFO format (slightly different syntax)
fn parse_umapinfo(content: &str, names: &mut HashMap<String, String>) {
    // UMAPINFO uses: MAP MAP01 { levelname = "Level Name" }
    let block_re =
        Regex::new(r#"(?i)MAP\s+(MAP\d+|E\d+M\d+)\s*\{([^}]*)\}"#).unwrap();
    let name_re = Regex::new(r#"(?i)levelname\s*=\s*"([^"]+)""#).unwrap();

    for caps in block_re.captures_iter(content) {
        let map_id = caps.get(1).unwrap().as_str().to_uppercase();
        let block = caps.get(2).unwrap().as_str();

        if let Some(name_caps) = name_re.captures(block) {
            let map_name = name_caps.get(1).unwrap().as_str().to_string();
            names.entry(map_id).or_insert(map_name);
        }
    }
}

/// Parse DEHACKED format for level names
/// Looks for [STRINGS] section with HUSTR_1, HUSTR_E1M1, etc.
fn parse_dehacked(content: &str, names: &mut HashMap<String, String>) {
    let mut in_strings = false;

    // HUSTR_1 through HUSTR_32 map to MAP01-MAP32
    // HUSTR_E1M1 etc. map directly
    let doom2_re = Regex::new(r"(?i)^HUSTR_(\d+)\s*=\s*(.+)$").unwrap();
    let doom1_re = Regex::new(r"(?i)^HUSTR_(E\d+M\d+)\s*=\s*(.+)$").unwrap();

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.eq_ignore_ascii_case("[STRINGS]") {
            in_strings = true;
            continue;
        }

        if trimmed.starts_with('[') && !trimmed.eq_ignore_ascii_case("[STRINGS]") {
            in_strings = false;
            continue;
        }

        if !in_strings {
            continue;
        }

        // Try Doom 2 format (HUSTR_1 = Level Name)
        if let Some(caps) = doom2_re.captures(trimmed) {
            let num: u32 = caps.get(1).unwrap().as_str().parse().unwrap_or(0);
            if num >= 1 && num <= 32 {
                let map_id = format!("MAP{:02}", num);
                let map_name = caps.get(2).unwrap().as_str().trim().to_string();
                names.entry(map_id).or_insert(map_name);
            }
        }

        // Try Doom 1 format (HUSTR_E1M1 = Level Name)
        if let Some(caps) = doom1_re.captures(trimmed) {
            let map_id = caps.get(1).unwrap().as_str().to_uppercase();
            let map_name = caps.get(2).unwrap().as_str().trim().to_string();
            names.entry(map_id).or_insert(map_name);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_mapinfo_simple() {
        let content = r#"
map MAP01 "Entryway"
map MAP02 "Underhalls"
map E1M1 "Hangar"
"#;
        let mut names = HashMap::new();
        parse_mapinfo(content, &mut names);

        assert_eq!(names.get("MAP01"), Some(&"Entryway".to_string()));
        assert_eq!(names.get("MAP02"), Some(&"Underhalls".to_string()));
        assert_eq!(names.get("E1M1"), Some(&"Hangar".to_string()));
    }

    #[test]
    fn test_parse_mapinfo_block() {
        let content = r#"
map MAP01 {
    levelname = "Test Level"
    music = "D_RUNNIN"
}
"#;
        let mut names = HashMap::new();
        parse_mapinfo(content, &mut names);

        assert_eq!(names.get("MAP01"), Some(&"Test Level".to_string()));
    }
}
