import { describe, expect, test } from "vitest";
import { parseBattleScribeRoster } from "@/lib/import/battlescribe";

/**
 * Inline sample roster: one army → two units → models.
 *   - "Intercessor Squad": 1 Sergeant + 9 Intercessors  (10 models, 2 lines)
 *   - "Redemptor Dreadnought": no model children        (1 synthetic model)
 */
const SAMPLE_ROS = `<?xml version="1.0" encoding="utf-8"?>
<roster name="Test Strike Force" battleScribeVersion="2.03">
  <costs><cost name="pts" value="410"/></costs>
  <forces>
    <force name="Patrol" catalogueName="Adeptus Astartes - Ultramarines">
      <selections>
        <selection name="Intercessor Squad" type="unit" number="1">
          <costs><cost name="pts" value="200"/></costs>
          <selections>
            <selection name="Intercessor Sergeant" type="model" number="1"/>
            <selection name="Intercessor" type="model" number="9"/>
          </selections>
        </selection>
        <selection name="Redemptor Dreadnought" type="unit" number="1">
          <costs><cost name="pts" value="210"/></costs>
          <selections>
            <selection name="Heavy Onslaught Gatling Cannon" type="upgrade" number="1"/>
          </selections>
        </selection>
      </selections>
    </force>
  </forces>
</roster>`;

describe("parseBattleScribeRoster", () => {
  test("extracts army name, units, and per-model breakdown", () => {
    const army = parseBattleScribeRoster(SAMPLE_ROS);

    expect(army.armyName).toBe("Test Strike Force");
    expect(army.units).toHaveLength(2);

    const intercessors = army.units.find((u) => u.name === "Intercessor Squad");
    expect(intercessors).toBeDefined();
    expect(intercessors!.models).toEqual([
      { name: "Intercessor Sergeant", count: 1 },
      { name: "Intercessor", count: 9 },
    ]);
  });

  test("a unit with no model children gets a single synthetic model", () => {
    const army = parseBattleScribeRoster(SAMPLE_ROS);
    const dread = army.units.find((u) => u.name === "Redemptor Dreadnought");
    expect(dread).toBeDefined();
    // The upgrade child is not a model, so the unit synthesises one model
    // named after itself with count 1.
    expect(dread!.models).toEqual([{ name: "Redemptor Dreadnought", count: 1 }]);
  });

  test("sums duplicate model lines by name", () => {
    const xml = `<roster name="Dupes"><forces><force><selections>
      <selection name="Boyz" type="unit">
        <selections>
          <selection name="Ork Boy" type="model" number="10"/>
          <selection name="Ork Boy" type="model" number="9"/>
          <selection name="Boss Nob" type="model" number="1"/>
        </selections>
      </selection>
    </selections></force></forces></roster>`;
    const army = parseBattleScribeRoster(xml);
    const boyz = army.units[0]!;
    expect(boyz.models).toEqual([
      { name: "Ork Boy", count: 19 },
      { name: "Boss Nob", count: 1 },
    ]);
  });

  test("finds models nested inside an upgrade group", () => {
    const xml = `<roster name="Nested"><forces><force><selections>
      <selection name="Command Squad" type="unit">
        <selections>
          <selection name="Bodyguard Upgrade" type="upgrade">
            <selections>
              <selection name="Company Veteran" type="model" number="4"/>
            </selections>
          </selection>
        </selections>
      </selection>
    </selections></force></forces></roster>`;
    const army = parseBattleScribeRoster(xml);
    expect(army.units[0]!.models).toEqual([
      { name: "Company Veteran", count: 4 },
    ]);
  });

  test("reads a count from a <number> child element when no attribute", () => {
    const xml = `<roster name="ChildCount"><forces><force><selections>
      <selection name="Guardsmen" type="unit">
        <selections>
          <selection name="Guardsman" type="model"><number>10</number></selection>
        </selections>
      </selection>
    </selections></force></forces></roster>`;
    const army = parseBattleScribeRoster(xml);
    expect(army.units[0]!.models).toEqual([{ name: "Guardsman", count: 10 }]);
  });

  test("handles a namespaced selection type ('unit:detachment')", () => {
    const xml = `<roster name="NS"><forces><force><selections>
      <selection name="Tank" type="unit:vehicle" number="1"/>
    </selections></force></forces></roster>`;
    const army = parseBattleScribeRoster(xml);
    expect(army.units).toHaveLength(1);
    expect(army.units[0]!.name).toBe("Tank");
    expect(army.units[0]!.models).toEqual([{ name: "Tank", count: 1 }]);
  });

  test("aggregates units across multiple forces", () => {
    const xml = `<roster name="MultiForce"><forces>
      <force><selections>
        <selection name="Unit A" type="unit" number="1"/>
      </selections></force>
      <force><selections>
        <selection name="Unit B" type="unit" number="1"/>
      </selections></force>
    </forces></roster>`;
    const army = parseBattleScribeRoster(xml);
    expect(army.units.map((u) => u.name)).toEqual(["Unit A", "Unit B"]);
  });

  test("skips non-unit top-level selections that have no models", () => {
    const xml = `<roster name="Mixed"><forces><force><selections>
      <selection name="Stratagem Pool" type="upgrade"/>
      <selection name="Real Unit" type="unit" number="1"/>
    </selections></force></forces></roster>`;
    const army = parseBattleScribeRoster(xml);
    expect(army.units.map((u) => u.name)).toEqual(["Real Unit"]);
  });

  test("malformed XML never throws — returns an empty army", () => {
    const army = parseBattleScribeRoster("<not> valid </xml>");
    expect(army.units).toEqual([]);
    expect(typeof army.armyName).toBe("string");
  });

  test("missing <roster> element returns an empty army", () => {
    const army = parseBattleScribeRoster("<?xml version='1.0'?><other/>");
    expect(army.armyName).toBe("Untitled army");
    expect(army.units).toEqual([]);
  });

  test("a roster with no name falls back to a default label", () => {
    const xml = `<roster><forces><force><selections>
      <selection name="Lonely Unit" type="unit" number="1"/>
    </selections></force></forces></roster>`;
    const army = parseBattleScribeRoster(xml);
    expect(army.armyName).toBe("Untitled BattleScribe army");
    expect(army.units).toHaveLength(1);
  });
});
