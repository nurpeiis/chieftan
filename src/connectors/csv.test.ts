import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CsvConnector } from "./csv.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("CsvConnector", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "csv-connector-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeCsv(name: string, content: string): string {
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  describe("fetch", () => {
    it("parses CSV file and returns ConnectorResults", async () => {
      const filePath = writeCsv(
        "expenses.csv",
        "date,category,amount,description\n2026-02-14,food,25.50,Lunch meeting\n2026-02-15,transport,12.00,Uber to office"
      );

      const connector = new CsvConnector({ filePath, name: "expenses" });
      const results = await connector.fetch();

      expect(results).toHaveLength(2);
      expect(results[0].source).toBe("csv:expenses");
      expect(results[0].category).toBe("data");
      expect(results[0].metadata).toHaveProperty("date", "2026-02-14");
      expect(results[0].metadata).toHaveProperty("amount", "25.50");
    });

    it("handles empty CSV (headers only)", async () => {
      const filePath = writeCsv("empty.csv", "col1,col2,col3\n");
      const connector = new CsvConnector({ filePath, name: "empty" });
      const results = await connector.fetch();
      expect(results).toEqual([]);
    });

    it("throws for non-existent file", async () => {
      const connector = new CsvConnector({
        filePath: "/tmp/does-not-exist.csv",
        name: "ghost",
      });
      await expect(connector.fetch()).rejects.toThrow();
    });

    it("uses first column as title if no title column specified", async () => {
      const filePath = writeCsv(
        "tasks.csv",
        "task,status,due\nFix bug,done,2026-02-14\nWrite tests,pending,2026-02-15"
      );

      const connector = new CsvConnector({ filePath, name: "tasks" });
      const results = await connector.fetch();

      expect(results[0].title).toBe("Fix bug");
      expect(results[1].title).toBe("Write tests");
    });

    it("uses specified titleColumn", async () => {
      const filePath = writeCsv(
        "items.csv",
        "id,name,value\n1,Widget A,100\n2,Widget B,200"
      );

      const connector = new CsvConnector({
        filePath,
        name: "items",
        titleColumn: "name",
      });
      const results = await connector.fetch();

      expect(results[0].title).toBe("Widget A");
    });
  });

  describe("name property", () => {
    it("returns the connector name", () => {
      const connector = new CsvConnector({
        filePath: "/tmp/test.csv",
        name: "my-data",
      });
      expect(connector.name).toBe("csv:my-data");
    });
  });
});
