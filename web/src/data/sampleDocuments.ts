/**
 * Sample construction documents seeded into the knowledge base on first load.
 * They are fictional but written to resemble real contract / specification language.
 * Each entry is plain text; it goes through exactly the same chunking + BM25
 * pipeline as a user-uploaded TXT file.
 */
export interface SampleDocument {
  id: string;
  name: string;
  category: string;
  text: string;
}

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: "seed-gc-2024",
    name: "BM-GC-2024 General Conditions (Excerpt).txt",
    category: "Contract",
    text: `BM-GC-2024 GENERAL CONDITIONS OF THE CONSTRUCTION CONTRACT
Applies to all BuildMind portfolio projects unless modified by Supplementary Conditions.

ARTICLE 8 - TIME

8.1 Contract Time. The Contract Time is the period stated in the Agreement for Substantial Completion of the Work. Time limits stated in the Contract Documents are of the essence.

8.2 Progress Schedule. The Contractor shall submit a critical path method (CPM) baseline schedule within 30 days after Notice to Proceed. The schedule shall be updated monthly and submitted with each Application for Payment. Each update shall show actual start and finish dates, remaining durations and the forecast date of Substantial Completion.

8.3 Recovery Schedule. If a monthly schedule update forecasts Substantial Completion more than 14 calendar days after the contractual date, the Contractor shall submit a Recovery Schedule within 10 working days. The Recovery Schedule shall describe added crews, extended shifts, resequencing or other measures to recover lost time, at no additional cost to the Owner unless the delay is excusable under Paragraph 8.4.

8.4 Excusable Delays. The Contractor is entitled to an extension of the Contract Time for delays caused by: (a) acts or omissions of the Owner or Architect; (b) changes ordered in the Work; (c) differing site conditions, including unmapped underground utilities; (d) unusually severe weather that could not have been reasonably anticipated; (e) fire, flood, epidemic or other casualty beyond the Contractor's control; and (f) delays by governmental authorities in issuing permits or inspections, provided the Contractor submitted complete applications on time.

8.5 Notice of Delay. A claim for an extension of time shall be made in writing within 21 calendar days after the occurrence of the event giving rise to the claim. Claims not made within 21 days are waived. The notice shall state the cause, the activities affected and the estimated impact on the critical path.

8.6 Concurrent Delay. Where excusable delay and non-excusable delay occur concurrently, the Contractor shall receive an extension of time but no compensation for the period of concurrency.

ARTICLE 9 - LIQUIDATED DAMAGES

9.1 Liquidated Damages. The Owner and Contractor agree that the Owner will suffer financial loss if the Work is not substantially complete within the Contract Time. The Contractor shall pay the Owner, as liquidated damages and not as a penalty, the daily amount stated in the Agreement for each calendar day that Substantial Completion is delayed beyond the Contract Time, as adjusted for approved extensions.

9.2 Cap. Total liquidated damages shall not exceed ten percent (10%) of the original Contract Sum.

9.3 Withholding. The Owner may withhold accrued liquidated damages from progress payments or from retainage.

9.4 Excusable Delay Relief. Liquidated damages shall not be assessed for any period of delay for which a time extension has been granted under Paragraph 8.4.

ARTICLE 10 - SUBSTANTIAL COMPLETION

10.1 Definition. Substantial Completion is the stage when the Work is sufficiently complete so the Owner can occupy or use it for its intended purpose, a temporary or final certificate of occupancy has been issued, and all life-safety systems are tested and accepted.

10.2 Punch List. The Contractor shall prepare a comprehensive list of items to be completed or corrected. Failure to include an item does not relieve the Contractor of responsibility to complete it.

10.3 Retainage. Five percent (5%) retainage is withheld from each progress payment. Upon Substantial Completion, retainage may be reduced to 150% of the value of remaining punch-list work.`,
  },
  {
    id: "seed-safety",
    name: "Site Safety Manual Rev 6.txt",
    category: "Safety",
    text: `BUILDMIND SITE SAFETY MANUAL - REVISION 6

SECTION 1 - RESPONSIBILITIES

1.1 Every worker has stop-work authority. Any person may stop an activity they believe is unsafe without fear of reprisal.

1.2 The Site Safety Manager shall conduct a daily walk of all active work areas and record findings in the safety log.

1.3 Each subcontractor shall hold a weekly toolbox talk with all of its workers. Attendance sheets shall be submitted to the Site Safety Manager every Friday.

SECTION 2 - PERSONAL PROTECTIVE EQUIPMENT

2.1 Minimum PPE on all sites: hard hat, safety glasses with side shields, high-visibility vest or shirt, and safety-toe boots.

2.2 Hearing protection is required where noise exceeds 85 dBA. Cut-resistant gloves are required when handling sheet metal, glass or rebar.

SECTION 3 - FALL PROTECTION

3.1 Fall protection is required for any work at a height of 6 feet or more above a lower level. Acceptable systems are guardrails, safety nets or personal fall arrest systems.

3.2 Personal fall arrest harnesses shall be inspected before each use. Any harness that has arrested a fall shall be removed from service immediately.

3.3 Floor openings shall be covered with secured, labeled covers capable of supporting twice the intended load.

SECTION 4 - EXCAVATION AND TRENCHING

4.1 Excavations 5 feet deep or more require a protective system: sloping, benching, shoring or a trench box, designed by a competent person.

4.2 Excavations 20 feet deep or more require a protective system designed by a registered professional engineer.

4.3 A competent person shall inspect excavations daily and after every rainstorm. Spoil piles shall be kept at least 2 feet from the edge.

4.4 Before any excavation, the Contractor shall call 811 for utility locates and pothole to verify the location of utilities within 5 feet of the planned excavation.

SECTION 5 - HOT WORK AND CRANES

5.1 Welding, cutting and torch work require a daily hot work permit. A fire watch shall remain for 60 minutes after hot work ends.

5.2 All crane lifts exceeding 75% of rated capacity, or lifts over occupied areas, are critical lifts and require a written lift plan signed by the lift director.

5.3 Crane operations shall stop when sustained wind speed exceeds 30 mph or as limited by the manufacturer.

SECTION 6 - INCIDENT REPORTING

6.1 All injuries, near misses and property damage shall be reported to the Site Safety Manager immediately and documented on an incident report within 24 hours.

6.2 Serious incidents (hospitalization, amputation or loss of an eye) shall be reported to OSHA within 24 hours; fatalities within 8 hours.

6.3 A root-cause investigation shall be completed within 5 working days and corrective actions tracked to closure.`,
  },
  {
    id: "seed-concrete",
    name: "Specification 03 30 00 Cast-in-Place Concrete.txt",
    category: "Specification",
    text: `SECTION 03 30 00 - CAST-IN-PLACE CONCRETE

PART 1 - GENERAL

1.1 Submittals. Submit mix designs for each class of concrete at least 21 days before the first placement, including aggregate gradation, admixtures and 28-day strength test history.

1.2 Quality Assurance. Testing shall be performed by an independent testing agency retained by the Owner.

PART 2 - PRODUCTS

2.1 Structural concrete shall have a minimum 28-day compressive strength of 5,000 psi unless noted otherwise on the drawings. Slabs on grade shall be 4,000 psi.

2.2 Maximum water-cementitious ratio: 0.45 for structural concrete and 0.40 for concrete exposed to freeze-thaw cycles and deicing chemicals.

2.3 Air entrainment of 6% plus or minus 1.5% is required for all exterior concrete exposed to freezing.

PART 3 - EXECUTION

3.1 Slump. Slump at point of placement shall be 4 inches plus or minus 1 inch, or up to 8 inches when a high-range water reducer is used.

3.2 Testing Frequency. Cast one set of four test cylinders for each 100 cubic yards, or fraction thereof, of each class of concrete placed in any one day. Test one cylinder at 7 days, two at 28 days and hold one in reserve.

3.3 Curing. Keep concrete continuously moist for a minimum of 7 days after placement, or until 70% of the specified strength is reached, using wet burlap, curing compound or insulated blankets.

3.4 Cold-Weather Concreting. Cold weather exists when the air temperature has fallen, or is expected to fall, below 40 degrees F during the protection period. Concrete temperature at placement shall be at least 55 degrees F. Protect concrete from freezing for at least 72 hours using heated enclosures or insulated blankets. Do not place concrete on frozen subgrade.

3.5 Hot-Weather Concreting. When ambient temperature exceeds 90 degrees F, concrete temperature at placement shall not exceed 95 degrees F. Use chilled water or ice, schedule placements in early morning and apply evaporation retarder.

3.6 Acceptance. Strength is acceptable when the average of any three consecutive tests equals or exceeds the specified strength and no individual test falls more than 500 psi below it. Low results require core testing at the Contractor's expense.`,
  },
  {
    id: "seed-change-orders",
    name: "Change Order and RFI Procedure.txt",
    category: "Procedure",
    text: `CHANGE ORDER AND REQUEST FOR INFORMATION (RFI) PROCEDURE

1. PURPOSE
This procedure defines how questions, design clarifications and changes to scope, cost or schedule are requested, priced, approved and documented on BuildMind projects.

2. REQUESTS FOR INFORMATION
2.1 RFIs shall be submitted through the project management platform using the standard form, with one question per RFI and a suggested solution where possible.
2.2 The Architect shall respond within 7 working days. Critical-path RFIs flagged as urgent shall be answered within 3 working days.
2.3 An RFI response that changes the cost or time of the Work shall be converted to a Change Order Request within 10 working days.

3. CHANGE ORDER REQUESTS
3.1 The Contractor shall submit a Change Order Request (COR) with a detailed breakdown of labor, materials, equipment and subcontract costs, and a schedule impact analysis using a fragnet inserted into the current CPM schedule.
3.2 Allowable markups: 10% overhead and 5% profit on self-performed work; 5% total markup on subcontracted work.
3.3 Time extensions requested in a COR must reference the notice of delay required by General Conditions Paragraph 8.5.

4. APPROVAL AUTHORITY
4.1 Changes up to $50,000: Project Manager approval.
4.2 Changes from $50,001 to $250,000: Project Executive approval.
4.3 Changes above $250,000 or any change adding more than 10 days to the Contract Time: Owner's Executive Committee approval.

5. DIRECTED CHANGES
5.1 Where agreement on price cannot be reached promptly, the Owner may issue a Construction Change Directive. The Contractor shall proceed with the work and track costs on a time-and-materials basis.

6. LOGGING
6.1 All RFIs, CORs and executed Change Orders shall be recorded in the change log, which is reviewed at the weekly owner-architect-contractor (OAC) meeting.`,
  },
  {
    id: "seed-closeout",
    name: "Quality Control and Closeout Plan.txt",
    category: "Quality",
    text: `QUALITY CONTROL AND PROJECT CLOSEOUT PLAN

SECTION A - QUALITY CONTROL

A.1 Three-Phase Inspection. Each definable feature of work shall go through a preparatory inspection, an initial inspection when work begins, and follow-up inspections daily until completion.

A.2 Mock-ups. Mock-ups are required for curtain wall, masonry, roofing and exterior sealant joints. Approved mock-ups are the standard of quality for the remaining work.

A.3 Non-Conformance Reports. Defective work shall be documented on a Non-Conformance Report (NCR) within 24 hours. NCRs shall be closed within 14 days or escalated to the Project Executive.

SECTION B - COMMISSIONING

B.1 Building systems including HVAC, electrical, fire alarm, medical gas and building automation shall be commissioned by a third-party Commissioning Authority.

B.2 Functional performance tests shall be witnessed and signed before Substantial Completion is requested.

SECTION C - CLOSEOUT

C.1 Before requesting Substantial Completion the Contractor shall submit: a draft punch list, the temporary certificate of occupancy, life-safety test reports and commissioning reports.

C.2 Punch-list items shall be completed within 30 days of Substantial Completion.

C.3 Final Completion requires: all punch-list items closed, as-built drawings, operation and maintenance (O&M) manuals, warranties, attic stock, training of Owner personnel and lien releases.

C.4 Warranty. The Contractor warrants all work for one (1) year from the date of Substantial Completion. Roofing carries a 20-year manufacturer warranty.`,
  },
  {
    id: "seed-bm101-report",
    name: "BM-101 Riverside Hospital Monthly Report Oct 2026.txt",
    category: "Project Report",
    text: `BM-101 RIVERSIDE REGIONAL HOSPITAL EXPANSION - MONTHLY PROGRESS REPORT, OCTOBER 2026

1. EXECUTIVE SUMMARY
Overall progress is 58% complete against 71% planned. The October schedule update forecasts Substantial Completion on May 14, 2027, which is 77 calendar days after the contractual date of February 26, 2027. Because the forecast slip exceeds 14 days, a Recovery Schedule was requested under General Conditions Paragraph 8.3.

2. SCHEDULE AND CRITICAL PATH
MEP rough-in finished on October 2, 2026, about three months late, driven by a shortage of certified medical gas installers. Building envelope dry-in is now forecast for December 11, 2026. The critical path runs through medical gas installation, HCAI above-ceiling inspections and final HCAI inspection.

3. DELAY CAUSES AND NOTICES
The Contractor submitted a notice of delay on September 3, 2026 for 31 days attributed to HCAI plan-check turnaround on Change Orders 14 and 17. The Owner is reviewing whether this qualifies as an excusable governmental delay. The remaining delay is attributed to labor shortages and is currently considered non-excusable.

4. RECOVERY MEASURES
The Contractor proposes a second shift for the medical gas subcontractor, pre-fabricated headwall assemblies and a dedicated HCAI inspector of record. These measures are expected to recover 25 to 35 days.

5. COST
Cost to date is $112.3 million of the $184.5 million contract. Pending change orders total $3.8 million. Liquidated damages under the Agreement are $25,000 per calendar day.

6. SAFETY
No lost-time incidents this month. Two near misses involving unsecured floor-opening covers on Level 4 were investigated and closed.`,
  },
  {
    id: "seed-bm103-permit",
    name: "BM-103 Cedar Creek Environmental Permit Summary.txt",
    category: "Permit",
    text: `BM-103 CEDAR CREEK BRIDGE REPLACEMENT - ENVIRONMENTAL PERMIT CONDITIONS SUMMARY

1. IN-WATER WORK WINDOW
In-water work, including cofferdam installation, pier excavation and scour-protection placement, is permitted only between July 1 and September 15 to protect spawning fish. No extension of the window will be granted.

2. TURBIDITY MONITORING
Turbidity shall be measured 100 feet upstream and 300 feet downstream of in-water work every two hours. Work shall stop if downstream turbidity exceeds upstream levels by more than 10 NTU.

3. SPILL PREVENTION
Equipment working over water shall use biodegradable hydraulic fluid. Spill kits shall be staged at each work zone and refueling shall occur at least 150 feet from the creek.

4. SCHEDULE IMPACT NOTE
Pier foundation work missed the 2025 in-water window by seven weeks after unexpected boulders were encountered, which pushed girder setting and deck work and is the main reason the bridge opening is now forecast for December 11, 2026 instead of October 30, 2026. The Contractor has filed a differing site conditions claim under General Conditions Paragraph 8.4(c).`,
  },
];
