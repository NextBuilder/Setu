use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn markdown(dir: &Path, out: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(dir).unwrap() {
        let p = entry.unwrap().path();
        if p.is_dir() {
            markdown(&p, out);
        } else if p.extension().is_some_and(|e| e == "md") {
            out.push(p);
        }
    }
}

fn tool_names() -> BTreeSet<String> {
    let docs = fs::read_to_string(root().join("docs/TOOLS.md")).unwrap();
    docs.lines()
        .filter_map(|l| l.strip_prefix("| `"))
        .filter_map(|l| l.split('`').next())
        .map(str::to_string)
        .collect()
}

fn listed_tools() -> BTreeSet<String> {
    let out = Command::new(env!("CARGO_BIN_EXE_setu"))
        .arg("--list-tools")
        .output()
        .unwrap();
    String::from_utf8(out.stdout)
        .unwrap()
        .lines()
        .map(str::to_string)
        .collect()
}

#[test]
fn tools_doc_matches_the_server() {
    assert_eq!(tool_names(), listed_tools());
}

#[test]
fn skills_mention_only_real_tools_and_resolve_their_links() {
    let tools = tool_names();
    let params: BTreeSet<&str> = [
        "ignore_nets",
        "keep_existing",
        "manufacturer_part",
        "supplier_part",
        "in_bom",
        "in_pcb",
        "output_dir",
        "corner_radius_mm",
        "timeout_s",
    ]
    .into();
    let mut files = Vec::new();
    markdown(&root().join("assets"), &mut files);
    let mut problems = Vec::new();
    for f in &files {
        let text = fs::read_to_string(f).unwrap();
        for part in text.split('`').skip(1).step_by(2) {
            let is_ident = part.contains('_')
                && part
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
                && part.starts_with(|c: char| c.is_ascii_lowercase())
                && !part.ends_with('_');
            if is_ident && !tools.contains(part) && !params.contains(part) {
                problems.push(format!("{}: unknown tool `{part}`", f.display()));
            }
        }
        let mut rest = text.as_str();
        while let Some(i) = rest.find("](") {
            rest = &rest[i + 2..];
            let target = rest.split(')').next().unwrap_or_default();
            if !target.starts_with("http") && !target.starts_with('#') && target.ends_with(".md") {
                let path = f.parent().unwrap().join(target);
                if !path.exists() {
                    problems.push(format!("{}: broken link {target}", f.display()));
                }
            }
        }
    }
    assert!(problems.is_empty(), "{}", problems.join("\n"));
}

#[test]
fn every_skill_and_reference_is_reachable_and_named_for_its_folder() {
    let skills = root().join("assets/skills");
    let mut problems = Vec::new();
    for entry in fs::read_dir(&skills).unwrap() {
        let dir = entry.unwrap().path();
        let name = dir.file_name().unwrap().to_string_lossy().to_string();
        let skill = fs::read_to_string(dir.join("SKILL.md"))
            .unwrap()
            .replace("\r\n", "\n");
        if !skill.contains(&format!("\nname: {name}\n")) {
            problems.push(format!("{name}: front matter name differs"));
        }
        let refs = dir.join("references");
        if refs.is_dir() {
            for r in fs::read_dir(refs).unwrap() {
                let file = r.unwrap().file_name().to_string_lossy().to_string();
                let linked = format!("references/{file}");
                if !skill.contains(&linked) {
                    problems.push(format!("{name}: {linked} is not linked from SKILL.md"));
                }
            }
        }
    }
    assert!(problems.is_empty(), "{}", problems.join("\n"));
}

#[test]
fn agents_preload_skills_that_exist() {
    let skills = root().join("assets/skills");
    for entry in fs::read_dir(root().join("assets/agents")).unwrap() {
        let path = entry.unwrap().path();
        let text = fs::read_to_string(&path).unwrap().replace("\r\n", "\n");
        let front = text.split("---").nth(1).unwrap();
        let mut in_skills = false;
        for line in front.lines() {
            if line.starts_with("skills:") {
                in_skills = true;
                continue;
            }
            if in_skills {
                match line.strip_prefix("  - ") {
                    Some(s) => assert!(
                        skills.join(s).join("SKILL.md").is_file(),
                        "{}: no skill {s}",
                        path.display()
                    ),
                    None => in_skills = false,
                }
            }
        }
    }
}
