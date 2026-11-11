use std::collections::HashSet;
use std::sync::Mutex;

pub const INSTRUCTIONS: &str = "SETU connects you to EasyEDA Pro. It works stage by stage, and every stage follows the same loop:
1. Before the first tool call of a stage, load that stage's skill and follow it.
2. When the stage is complete, hand it to its review agent, which has a fresh context.
3. Fix every finding the professional way (the skill's method, not a workaround), then review again. Move on only when the review is clean.

Stage → skill → review agent:
- Any EasyEDA task → easyeda (operating rules) → —
- A new board, end to end → easyeda-pro-workflow → each stage's agent below
- Requirements and parts → easyeda-part-sourcing, easyeda-power-design, easyeda-mcu-design or easyeda-esp32 → —
- Schematic → easyeda-schematic → easyeda-design-review-agent (schematic scope)
- Placement and routing → easyeda-pro-layout, plus easyeda-multilayer, easyeda-high-speed-rf or easyeda-power-electronics when they apply → easyeda-pro-review-agent
- Silkscreen and product look → easyeda-pro-silkscreen, easyeda-board-craft → easyeda-pro-review-agent
- Manufacturing files → easyeda-manufacture → easyeda-manufacture-agent
- Anything no tool covers → easyeda-api (run_script)

A whole schematic can be delegated to easyeda-schematic-build-agent and a whole layout to easyeda-layout-agent. In Claude the names carry the plugin prefix (setu:easyeda-schematic, setu:easyeda-pro-review-agent). Start a session with setu_status. Tool results add a short [setu] line when a stage starts or ends; act on it.";

struct Stage {
    name: &'static str,
    skill: &'static str,
}

const SCHEMATIC: Stage = Stage {
    name: "schematic",
    skill: "easyeda-schematic",
};
const LAYOUT: Stage = Stage {
    name: "placement and routing",
    skill: "easyeda-pro-layout",
};
const SILKSCREEN: Stage = Stage {
    name: "silkscreen",
    skill: "easyeda-pro-silkscreen",
};
const PARTS: Stage = Stage {
    name: "part selection",
    skill: "easyeda-part-sourcing",
};
const POWER: Stage = Stage {
    name: "power design",
    skill: "easyeda-power-design",
};
const HIGH_SPEED: Stage = Stage {
    name: "high-speed and RF",
    skill: "easyeda-high-speed-rf",
};
const MANUFACTURE: Stage = Stage {
    name: "manufacturing",
    skill: "easyeda-manufacture",
};
const SCRIPT: Stage = Stage {
    name: "scripting",
    skill: "easyeda-api",
};

fn stage(tool: &str) -> Option<&'static Stage> {
    Some(match tool {
        "place_schematic_component"
        | "modify_schematic_component"
        | "add_wires"
        | "add_net_flags"
        | "delete_schematic_items" => &SCHEMATIC,
        "import_changes_to_pcb"
        | "set_component_placements"
        | "auto_place"
        | "add_track"
        | "add_vias"
        | "add_copper_pour"
        | "add_board_outline"
        | "add_mounting_holes"
        | "auto_route"
        | "set_copper_layers"
        | "create_net_class" => &LAYOUT,
        "add_board_text" => &SILKSCREEN,
        "search_parts" | "get_parts_by_lcsc" => &PARTS,
        "calc_buck" | "calc_regulator_thermal" | "calc_trace_width" => &POWER,
        "calc_impedance" | "create_differential_pair" => &HIGH_SPEED,
        "export_manufacturing" => &MANUFACTURE,
        "run_script" => &SCRIPT,
        _ => return None,
    })
}

fn milestone(tool: &str) -> Option<&'static str> {
    match tool {
        "run_erc" => Some("When ERC is clean and every block is drawn, the schematic stage is complete: run the easyeda-design-review-agent on it (schematic scope), fix every finding, and review again before any layout work."),
        "import_changes_to_pcb" => Some("The board now follows the schematic. If the schematic changed since its last clean review by the easyeda-design-review-agent, run that review first."),
        "auto_place" => Some("Auto placement is only a draft: review it with view_design against the easyeda-pro-layout placement order and fix every part by hand before routing."),
        "auto_route" => Some("Routing applied: run run_drc and view_design. When copper and silkscreen are finished, run the easyeda-pro-review-agent, fix every finding, and review again."),
        "run_drc" => Some("When DRC is clean and the layout is finished, run the easyeda-pro-review-agent before any manufacturing files; fix every finding and review again."),
        "export_manufacturing" => Some("Files exported: run the easyeda-manufacture-agent to check them against the board before ordering; fix every finding and export again."),
        _ => None,
    }
}

#[derive(Default)]
pub struct Guide {
    started: Mutex<HashSet<&'static str>>,
}

impl Guide {
    pub fn note(&self, tool: &str) -> Option<String> {
        let mut lines = Vec::new();
        if let Some(s) = stage(tool) {
            let fresh = self
                .started
                .lock()
                .map(|mut set| set.insert(s.skill))
                .unwrap_or(false);
            if fresh {
                lines.push(format!(
                    "[setu] {} stage: load the {} skill now if it is not loaded, and follow it for every step of this stage.",
                    s.name, s.skill
                ));
            }
        }
        if let Some(next) = milestone(tool) {
            lines.push(format!(
                "[setu] {next} (A review agent running this check itself ignores this line.)"
            ));
        }
        (!lines.is_empty()).then(|| lines.join("\n"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn announces_a_stage_once_and_ends_it_with_its_agent() {
        let g = Guide::default();
        assert!(g.note("add_wires").unwrap().contains("easyeda-schematic"));
        assert!(g.note("add_net_flags").is_none());
        assert!(g
            .note("run_drc")
            .unwrap()
            .contains("easyeda-pro-review-agent"));
        assert!(g
            .note("export_manufacturing")
            .unwrap()
            .contains("easyeda-manufacture-agent"));
    }
}
