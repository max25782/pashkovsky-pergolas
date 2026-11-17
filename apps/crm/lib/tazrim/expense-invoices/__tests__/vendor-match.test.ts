import { vendorNameSuggestions } from "../vendor-match";

describe("vendor name suggestions", () => {
  const vendors = [
    { id: "paz", name: "Paz Ashdod" },
    { id: "glass", name: "זכוכית בע\"מ" },
  ];

  it("offers a similar name and does not treat it as exact", () => {
    const hits = vendorNameSuggestions("Paz", vendors);
    expect(hits).toEqual([{ id: "paz", name: "Paz Ashdod", exact: false }]);
  });

  it("marks a normalized exact name", () => {
    expect(vendorNameSuggestions("זכוכית בעמ", vendors)).toEqual([
      { id: "glass", name: "זכוכית בע\"מ", exact: true },
    ]);
  });
});
