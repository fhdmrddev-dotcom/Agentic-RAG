"""Generate sample CAD drawing (.dxf) and sample Rate Sheet (.xlsx) for testing takeoff."""
import os
import ezdxf
import openpyxl

out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "samples", "takeoff"))
os.makedirs(out_dir, exist_ok=True)

# 1. Generate CAD Drawing (sample_structural_drawing.dxf)
doc = ezdxf.new("R2010", units=4)  # 4 = mm
msp = doc.modelspace()

# Define steel blocks
w_blk = doc.blocks.new("W250x33")
w_blk.add_line((0, 0), (250, 0))
w_blk.add_line((125, 0), (125, 330))
w_blk.add_line((0, 330), (250, 330))

c_blk = doc.blocks.new("C250x23")
c_blk.add_line((0, 0), (250, 0))
c_blk.add_line((0, 0), (0, 75))
c_blk.add_line((0, 75), (250, 75))

dr_blk = doc.blocks.new("DR-3684")
dr_blk.add_circle((0, 0), 914)

# Place counted instances in modelspace
for i in range(8):
    msp.add_blockref("W250x33", (i * 3000, 0))
for i in range(4):
    msp.add_blockref("C250x23", (i * 6000, 4000))
for i in range(3):
    msp.add_blockref("DR-3684", (i * 8000, 8000))

# Add dimensions and render
dim = msp.add_linear_dim(base=(0, -500), p1=(0, 0), p2=(24000, 0), dxfattribs={"layer": "DIMENSIONS"})
dim.render()

# Add engineer's specs & notes (MTEXT)
msp.add_mtext(r'\A1;1/2" [12.5mm] GYPSUM BOARD\PFIRE RATED AT PARTITIONS', dxfattribs={"layer": "SPEC_NOTES"})
msp.add_mtext(r'\A1;60 MIL EPDM ROOF MEMBRANE\POVER 2" RIGID INSULATION', dxfattribs={"layer": "ROOFING_SPEC"})
msp.add_mtext(r'\A1;3/4" EXTERIOR PLYWOOD SHEATHING', dxfattribs={"layer": "EXTERIOR_SPEC"})

# Add some lines on layers
msp.add_line((0, 0), (24000, 0), dxfattribs={"layer": "GRID_X"})
msp.add_line((0, 0), (0, 12000), dxfattribs={"layer": "GRID_Y"})

dxf_file = os.path.join(out_dir, "sample_structural_drawing.dxf")
doc.saveas(dxf_file)
print(f"Created: {dxf_file}")

# 2. Generate Master Rate Sheet (sample_master_rate_sheet.xlsx)
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Commercial Rates 2026"

ws.append(["Item Code", "Description", "Unit", "Rate"])
ws.append(["ST-W250", "Wide flange steel beam W250x33 structural framing", "m", 120.00])
ws.append(["ST-C250", "Channel section C250x23 structural framing", "m", 85.50])
ws.append(["DR-3684", "Hollow metal single door 36x84 with frame and hardware", "ea", 450.00])
ws.append(["CL-GYP", "Suspended gypsum board ceiling system 12.5mm", "m2", 31.00])
ws.append(["GB-12", '1/2" (12.5mm) Gypsum board wall partition, taped & finished', "m2", 18.75])
ws.append(["RF-EPDM", "60 mil EPDM fully adhered single-ply roof membrane", "m2", 42.00])
ws.append(["WD-PLY34", '3/4" Exterior grade CDX structural plywood sheathing', "m2", 26.50])

xlsx_file = os.path.join(out_dir, "sample_master_rate_sheet.xlsx")
wb.save(xlsx_file)
print(f"Created: {xlsx_file}")
