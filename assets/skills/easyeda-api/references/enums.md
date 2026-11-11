# EasyEDA Pro API enums

Member = value for every enum of the EasyEDA Pro extension API. In `run_script`, use the
member (`EPCB_LayerId.TOP`) when the global exists; the value is the fallback.

## EDMT_EditorDocumentType

BLANK = 0, FOOTPRINT = 4, HOME = -1, PANEL = 26, PANEL_3D_PREVIEW = 27, PANEL_LIBRARY = 29, PCB = 3, PCB_2D_PREVIEW = 12, PCB_3D_PREVIEW = 15, PROJECT = 5, SCHEMATIC_PAGE = 1, SIMULATION_SCHEMATIC_PAGE_NGSPICE = 8, SIMULATION_SCHEMATIC_PAGE_SIMULIDE = 9, SIMULATION_SYMBOL_COMPONENT_NGSPICE = 7, SIMULATION_SYMBOL_COMPONENT_SIMULIDE = 32, SYMBOL_CBB = 17, SYMBOL_COMPONENT = 2, SYMBOL_DRAWING = 20, SYMBOL_NET_FLAG = 18, SYMBOL_NET_PORT = 19, SYMBOL_NON_ELECTRICAL = 21, SYMBOL_OFF_PAGE_CONNECTOR_FLAG = 25, SYMBOL_SHORT_CIRCUIT_FLAG = 22

## EDMT_EditorSplitScreenDirection

HORIZONTAL = 'horizontal', VERTICAL = 'vertical'

## EDMT_EditorTabEventType

CLOSE = 'close', OPEN = 'open', TOGGLE = 'toggle'

## EDMT_IndicatorMarkerType

ARC = 'arc', CIRCLE = 'circle', LINE = 'line', POINT = 'point', RECTANGLE = 'rectangle'

## EDMT_ItemType

BOARD = 'Board', CBB_PCB = 'CBB PCB', CBB_PROJECT = 'CBB Project', CBB_SCHEMATIC = 'CBB Schematic', FOLDER = 'Folder', PANEL = 'Panel', PCB = 'PCB', PROJECT = 'Project', SCHEMATIC = 'Schematic', SCHEMATIC_PAGE = 'Schematic Page', TEAM = 'Team', WORKSPACE = 'Workspace'

## EDMT_ProjectCollaborationMode

FREE = 1, STRICT = 3

## EDMT_ProjectFileFormat

EPRJ2 = 'eprj2', EPRJ3 = 'eprj3'

## EDMT_ProjectReadyState

FAILED = 'failed', LOADING = 'loading', NOT_LOADED = 'notLoaded', READY = 'ready'

## ELIB_DeviceJlcLibraryCategory

EXTEND = 'extend', STANDARD = 'standard'

## ELIB_LibraryType

CBB = '1', DEVICE = '3', FOOTPRINT = '4', MODEL = '5', PANEL_LIBRARY = '29', SIMULATION_MODEL_NGSPICE = '32', SIMULATION_MODEL_SIMULIDE = '33', SYMBOL = '2'

## ELIB_PreviewType

FOOTPRINT = 'F', MODEL_3D = '3D', PRODUCT = 'P', SYMBOL = 'S'

## ELIB_SimulationModelType

NGSPICE = 'Ngspice', SIMULIDE = 'SimulIDE'

## ELIB_SymbolType

CBB_SYMBOL = 17, COMPONENT = 2, DIFFERENTIAL_PAIRS_FLAG = 31, DRAWING = 20, NET_FLAG = 18, NET_PORT = 19, NON_ELECTRICAL = 21, OFF_PAGE_CONNECTOR = 25, SHORT_CIRCUIT_FLAG = 22

## EPCB_AutoRoutingCornerStyle

DEGREE_45 = 0, DEGREE_90 = 1

## EPCB_AutoRoutingExistingPrimitiveMode

KEEP = 'keep', REMOVE = 'remove'

## EPCB_AutoRoutingOptimization

COMPLETION = 1, FASTER = 0

## EPCB_DocumentCanvasUpdateCalculationActiveStatus

ACTIVE = 'active', INACTIVE = 'inactive'

## EPCB_DocumentRatlineCalculatingActiveStatus

ACTIVE = 'active', INACTIVE = 'inactive'

## EPCB_InactiveLayerDisplayMode

HIDE = 2, NORMAL_BRIGHTNESS = 0, TURN_GRAY = 1

## EPCB_LayerColorConfiguration

ALTIUM_DESIGNER = 2, EASYEDA = 1, JLCEDA = 1, KICAD = 4, PADS = 3

## EPCB_LayerId

BOARD_OUTLINE = 11, BOTTOM = 2, BOTTOM_ASSEMBLY = 10, BOTTOM_PASTE_MASK = 8, BOTTOM_SILKSCREEN = 4, BOTTOM_SOLDER_MASK = 6, BOTTOM_STIFFENER = 59, COMPONENT_MARKING = 49, COMPONENT_MODEL = 52, COMPONENT_SHAPE = 48, CUSTOM_1 = 71, CUSTOM_10 = 80, CUSTOM_11 = 81, CUSTOM_12 = 82, CUSTOM_13 = 83, CUSTOM_14 = 84, CUSTOM_15 = 85, CUSTOM_16 = 86, CUSTOM_17 = 87, CUSTOM_18 = 88, CUSTOM_19 = 89, CUSTOM_2 = 72, CUSTOM_20 = 90, CUSTOM_21 = 91, CUSTOM_22 = 92, CUSTOM_23 = 93, CUSTOM_24 = 94, CUSTOM_25 = 95, CUSTOM_26 = 96, CUSTOM_27 = 97, CUSTOM_28 = 98, CUSTOM_29 = 99, CUSTOM_3 = 73, CUSTOM_30 = 100, CUSTOM_4 = 74, CUSTOM_5 = 75, CUSTOM_6 = 76, CUSTOM_7 = 77, CUSTOM_8 = 78, CUSTOM_9 = 79, DOCUMENT = 13, DRILL_DRAWING = 56, HOLE = 47, INNER_1 = 15, INNER_10 = 24, INNER_11 = 25, INNER_12 = 26, INNER_13 = 27, INNER_14 = 28, INNER_15 = 29, INNER_16 = 30, INNER_17 = 31, INNER_18 = 32, INNER_19 = 33, INNER_2 = 16, INNER_20 = 34, INNER_21 = 35, INNER_22 = 36, INNER_23 = 37, INNER_24 = 38, INNER_25 = 39, INNER_26 = 40, INNER_27 = 41, INNER_28 = 42, INNER_29 = 43, INNER_3 = 17, INNER_30 = 44, INNER_4 = 18, INNER_5 = 19, INNER_6 = 20, INNER_7 = 21, INNER_8 = 22, INNER_9 = 23, MECHANICAL = 14, MULTI = 12, PIN_FLOATING = 51, PIN_SOLDERING = 50, RATLINE = 57, SHELL_3D_BOTTOM = 55, SHELL_3D_OUTLINE = 53, SHELL_3D_TOP = 54, SUBSTRATE_1 = 101, TOP = 1, TOP_ASSEMBLY = 9, TOP_PASTE_MASK = 7, TOP_SILKSCREEN = 3, TOP_SOLDER_MASK = 5, TOP_STIFFENER = 58

## EPCB_LayerStatus

HIDDEN = 2, NOT_USED = 0, SHOW = 1

## EPCB_LayerType

ASSEMBLY = 'ASSEMBLY', CUSTOM = 'CUSTOM', INTERNAL_ELECTRICAL = 'PLANE', OTHER = 'OTHER', PASTE_MASK = 'PASTE_MASK', SIGNAL = 'SIGNAL', SILKSCREEN = 'SILKSCREEN', SOLDER_MASK = 'SOLDER_MASK'

## EPCB_MouseEventType

CLEAR_SELECTED = 'clearSelected', MOVE = 'move', SELECTED = 'selected'

## EPCB_NetEventType

ADD = 'add', REMOVE = 'remove', SELECTED = 'selected'

## EPCB_PcbPlateType

FPC = 2, NORMAL = 1

## EPCB_PdfOutputMethod

MULTI_PAGE_PDF = 'paged', MULTIPLE_SINGLE_PAGE_PDF = 'separated', SINGLE_PAGE_PDF = 'merged'

## EPCB_PrimitiveArcInteractiveMode

CENTER_ARC = 2, TWO_POINT_ARC = 1

## EPCB_PrimitiveDimensionType

ANGLE = 'Protractor Dimension', LENGTH = 'Length Dimension', RADIUS = 'Radius Dimension'

## EPCB_PrimitiveEventType

CREATE = 'add', DELETE = 'delete', MODIFY = 'modify'

## EPCB_PrimitiveFillMode

INNER_ELECTRICAL_LAYER = 2, MESH = 1, SOLID = 0

## EPCB_PrimitivePadHeatWeldingConnectionMethod

DIRECT_CONNECTED = 'Direct-connected', DIVERGENT = 'Divergent', NON_CONNECTED = 'Non-connected'

## EPCB_PrimitivePadHoleType

RECTANGLE = 'RECT', ROUND = 'ROUND', SLOT = 'SLOT'

## EPCB_PrimitivePadShapeType

ELLIPSE = 'ELLIPSE', OBLONG = 'OVAL', POLYLINE_COMPLEX_POLYGON = 'POLYGON', RECTANGLE = 'RECT', REGULAR_POLYGON = 'NGON'

## EPCB_PrimitivePadType

MARK_POINT = 2, NORMAL = 0, TEST = 1

## EPCB_PrimitivePourFillMethod

GRID = '90grid', GRID45 = '45grid', SOLID = 'solid'

## EPCB_PrimitiveRegionRuleType

FOLLOW_REGION_RULE = 9, NO_COMPONENTS = 2, NO_FILLS = 6, NO_INNER_ELECTRICAL_LAYERS = 8, NO_POURS = 7, NO_WIRES = 5

## EPCB_PrimitiveStringAlignMode

CENTER = 5, CENTER_BOTTOM = 6, CENTER_TOP = 4, LEFT_BOTTOM = 3, LEFT_MIDDLE = 2, LEFT_TOP = 1, RIGHT_BOTTOM = 9, RIGHT_MIDDLE = 8, RIGHT_TOP = 7

## EPCB_PrimitiveType

ARC = 'Arc', ATTRIBUTE = 'Attribute', COMPONENT = 'Component', COMPONENT_PAD = 'ComponentPad', DIMENSION = 'Dimension', FILL = 'Fill', IMAGE = 'Image', LINE = 'Line', OBJECT = 'Object', PAD = 'Pad', POLYLINE = 'Polyline', POUR = 'Pour', POURED = 'Poured', REGION = 'Region', STRING = 'String', VIA = 'Via'

## EPCB_PrimitiveViaType

BLIND = 1, SUTURE = 2, VIA = 0

## ESCH_DynamicSimulationEnginePullEventType

COMPONENT_UPDATE = 'COMPONENT_UPDATE', SESSION_PAUSE = 'SESSION_PAUSE', SESSION_RESUME = 'SESSION_RESUME', SESSION_START = 'SESSION_START', SESSION_STATE_QUERY = 'SESSION_STATE_QUERY', SESSION_STOP = 'SESSION_STOP', SPEED_SET = 'SPEED_SET'

## ESCH_DynamicSimulationEnginePushEventType

ENGINE_ERROR = 'ENGINE_ERROR', ENGINE_LOG = 'ENGINE_LOG', SESSION_STATE = 'SESSION_STATE', STREAM_DATA = 'STREAM_DATA', STREAM_SNAPSHOT = 'STREAM_SNAPSHOT'

## ESCH_ExportDocumentFileType

PDF = 'PDF', PNG = 'PNG', SVG = 'SVG'

## ESCH_MouseEventType

CLEAR_SELECTED = 'clearSelected', SELECTED = 'selected'

## ESCH_PrimitiveComponentType

CBB_SYMBOL = 'block_symbol', COMPONENT = 'part', DIFFERENTIAL_PAIRS_FLAG = 'diffPairsFlag', DRAWING = 'sheet', NET_FLAG = 'netflag', NET_PORT = 'netport', NON_ELECTRICAL_FLAG = 'nonElectrical_symbol', OFF_PAGE_CONNECTOR = 'offPageConnector', SHORT_CIRCUIT_FLAG = 'short_symbol'

## ESCH_PrimitiveEventType

CHANGE = 'change', CREATE = 'create', DELETE = 'delete', MOVE = 'move'

## ESCH_PrimitiveFillStyle

GRID = 'Grid', HORIZONTAL_LINE = 'Horizontal Line', LEFT_SLASH_LINE = 'Left Slash Line', NONE = 'None', RHOMBIC_GRID = 'Rhombic Grid', RIGHT_SLASH_LINE = 'Right Slash Line', SOLID = 'Solid', VERTICAL_LINE = 'Vertical Line'

## ESCH_PrimitiveLineType

DASHED = 1, DOT_DASHED = 3, DOTTED = 2, SOLID = 0

## ESCH_PrimitivePinShape

CLOCK = 'Clock', INVERTED = 'Inverted', INVERTED_CLOCK = 'Inverted Clock', NONE = 'None'

## ESCH_PrimitivePinType

BI = 'BI', GROUND = 'Ground', HIZ = 'HIZ', IN = 'IN', OPEN_COLLECTOR = 'Open Collector', OPEN_EMITTER = 'Open Emitter', OUT = 'OUT', PASSIVE = 'Passive', POWER = 'Power', TERMINATOR = 'Terminator', UNDEFINED = 'Undefined'

## ESCH_PrimitiveTextAlignMode

CENTER = 5, CENTER_BOTTOM = 6, CENTER_TOP = 4, LEFT_BOTTOM = 3, LEFT_MIDDLE = 2, LEFT_TOP = 1, RIGHT_BOTTOM = 9, RIGHT_MIDDLE = 8, RIGHT_TOP = 7

## ESCH_PrimitiveType

ARC = 'Arc', ATTRIBUTE = 'Attribute', BEZIER = 'Bezier', BUS = 'Bus', CIRCLE = 'Circle', COMPONENT = 'Component', COMPONENT_PIN = 'ComponentPin', ELLIPSE = 'Ellipse', OBJECT = 'Object', PIN = 'Pin', POLYGON = 'Polygon', RECTANGLE = 'Rectangle', TEXT = 'Text', WIRE = 'Wire'

## ESCH_SimulationNetlistType

NGSPICE = 'Ngspice'

## ESCH_SpiceSimulationEnginePullEventType

SIMULATE_NETLIST = 'SIMULATE_NETLIST', VALIDATE_NETLIST = 'VALIDATE_NETLIST'

## ESCH_SpiceSimulationEnginePushEventType

ERROR_RESULT = 'ERROR_RESULT', LOG_RESULT = 'LOG_RESULT', SIMULATION_RESULT = 'SIMULATION_RESULT', VALIDATION_RESULT = 'VALIDATION_RESULT'

## ESYS_BottomPanelTab

FIND = 'findResult', LIBRARY = 'library', LOG = 'log', PCB_DRC = 'drcResult', SCHEMATIC_DRC = 'schDrcResult'

## ESYS_HeaderMenuEnvironment

BLANK = 'blank', FOOTPRINT = 'footprint', HOME = 'home', PANEL = 'panel', PANEL_LIBRARY = 'panelLibrary', PANEL_VIEW = 'panelView', PCB = 'pcb', PCB_VIEW = 'pcbView', SCHEMATIC = 'sch', SIMULATION_SCHEMATIC_NGSPICE = 'simulationSchematicNgspice', SIMULATION_SCHEMATIC_SIMULIDE = 'simulationSchematicSimulIDE', SYMBOL = 'symbol'

## ESYS_ImportProjectBoardOutlineSource

FROM_KEEPOUT_LAYER = 'keepout', FROM_MECHANICAL_LAYER_1 = 'mechanical'

## ESYS_ImportProjectImportOption

EXTRACT_LIBRARIES = 'ExtractLibraries', IMPORT_DOCUMENT = 'ImportDocument', IMPORT_DOCUMENT_EXTRACT_LIBRARIES = 'ImportDocumentExtractLibraries'

## ESYS_ImportProjectSchematicObjectStyle

USE_SOURCE_FILE_STYLE = 'custom', USE_SYSTEM_THEME = 'system'

## ESYS_ImportProjectViaSolderMaskExpansion

ALL_COVER_OIL = 'cover', FOLLOW_ORIGINAL_SETTING = 'custom'

## ESYS_JobState

CANCELED = 'canceled', COMPLETED = 'completed', FAILED = 'failed', QUEUED = 'queued', RUNNING = 'running'

## ESYS_LeftPanelTab

BASIC_LIBRARY = 'basicLibrary', DEVICE_STANDARDIZATION = 'device-standardization', LIB_DESIGN = 'libDesign', PROJECT_DESIGN = 'projectDesign', PROJECT_LIST = 'project_list'

## ESYS_LogType

ERROR = 'error', FATAL_ERROR = 'fatalError', INFO = 'info', WARNING = 'warn'

## ESYS_NetlistType

ALLEGRO = 'Allegro', ALTIUM_DESIGNER = 'Protel2', DISA = 'DISA', DISA_SIMULATION = 'DSNET', EASYEDA_PRO = 'EasyEDA', JLCEDA_PRO = 'JLCEDA', PADS = 'PADS', PROTEL2 = 'Protel2'

## ESYS_PanelPosition

BOTTOM = 'bottom', LEFT = 'left', RIGHT = 'right'

## ESYS_PanelTab

ANNOTATION = 'annotation', BASIC_LIBRARY = 'basicLibrary', DEVICE_STANDARDIZATION = 'device-standardization', FIND = 'findResult', LIB_DESIGN = 'libDesign', LIBRARY = 'library', LOG = 'log', PANEL_3D_PREVIEW_ATTR = 'panel3d-attr', PANEL_3D_PREVIEW_LAYER = 'panel3d-layer', PANEL_ATTR = 'panel-attr', PANEL_FILTER = 'panel-filter', PANEL_LAYER = 'panel-layer', PCB_2D_PREVIEW_ATTR = 'pcb2d-attr', PCB_3D_PREVIEW_ATTR = 'pcb3d-attr', PCB_3D_PREVIEW_LAYER = 'pcb3d-layer', PCB_ATTR = 'pcb-attr', PCB_DRC = 'drcResult', PCB_FILTER = 'pcb-filter', PCB_LAYER = 'pcb-layer', PCB_SKETCHER_ATTR = 'pcb-sketcher-attr', PROJECT_ATTR = 'project-attr', PROJECT_DESIGN = 'projectDesign', PROJECT_LIST = 'project_list', SCH_ATTR = 'sch-attr', SCH_FILTER = 'sch-filter', SCHEMATIC_DRC = 'schDrcResult'

## ESYS_RightPanelTab

ANNOTATION = 'annotation', PANEL_3D_PREVIEW_ATTR = 'panel3d-attr', PANEL_3D_PREVIEW_LAYER = 'panel3d-layer', PANEL_ATTR = 'panel-attr', PANEL_FILTER = 'panel-filter', PANEL_LAYER = 'panel-layer', PCB_2D_PREVIEW_ATTR = 'pcb2d-attr', PCB_3D_PREVIEW_ATTR = 'pcb3d-attr', PCB_3D_PREVIEW_LAYER = 'pcb3d-layer', PCB_ATTR = 'pcb-attr', PCB_FILTER = 'pcb-filter', PCB_LAYER = 'pcb-layer', PCB_SKETCHER_ATTR = 'pcb-sketcher-attr', PROJECT_ATTR = 'project-attr', SCH_ATTR = 'sch-attr', SCH_FILTER = 'sch-filter'

## ESYS_ShortcutKeyEffectiveEditorRange

ASSEMBLY_VARIANT = 11, BLANK = 0, FOOTPRINT = 5, HOME = 1, PANEL = 6, PANEL_3D_PREVIEW = 9, PANEL_LIBRARY = 10, PCB = 4, PCB_2D_PREVIEW = 8, PCB_3D_PREVIEW = 7, SCHEMATIC_PAGE = 2, SIMULATION_SCHEMATIC_PAGE_NGSPICE = 12, SIMULATION_SCHEMATIC_PAGE_SIMULIDE = 13, SIMULATION_WAVEFORM = 14, SYMBOL = 3

## ESYS_ShortcutKeyEffectiveEditorScene

CANVAS_NOT_SELECT = 3, CANVAS_SELECTED = 2, DRAWING = 4, EDITOR = 1, LOCAL = 6, PLACING = 5

## ESYS_StartPageQuickStartItem

ABOUT = 'About', IMPORT_ALTIUM = 'Import Altium', IMPORT_KICAD = 'Import KiCad', IMPORT_OTHER = 'Import Other', IMPORT_PROFESSIONAL = 'Import Professional', IMPORT_STANDARD = 'Import Standard', MIGRATE_STANDARD = 'Migrate Standard', NEW_3D_MODEL = 'New 3D Model', NEW_COMPONENT = 'New Component', NEW_FOOTPRINT = 'New Footprint', NEW_LIBRARY = 'New Library', NEW_PROJECT = 'New Project', NEW_REUSE_BLOCK = 'New Reuse Block', NEW_SYMBOL = 'New Symbol', OPEN_PROJECT = 'Open Project', SETTING = 'Setting'

## ESYS_Theme

DARK = 'dark', LIGHT = 'light'

## ESYS_ToastMessageType

ASK = 'question', ERROR = 'error', INFO = 'info', SUCCESS = 'success', WARNING = 'warn'

## ESYS_Unit

CENTIMETER = 'cm', DECIMETER = 'dm', IN = 'in', INCH = 'inch', METER = 'm', MIL = 'mil', MILLIMETER = 'mm'

## ESYS_WindowEventType

BLUR = 'blur', DROP = 'drop', FOCUS = 'focus'

## ESYS_WindowOpenTarget

BLANK = '_blank', SELF = '_self'

## NetportDeviceName

BI = 'Netport-BI', Ground = 'Netport-Ground', HIZ = 'Netport-HIZ', IN = 'Netport-IN', OpenCollector = 'Netport-Open-Collector', OpenEmitter = 'Netport-Open-Emitter', OUT = 'Netport-OUT', Passive = 'Netport-Passive', Power = 'Netport-Power', Terminator = 'Netport-Terminator', Undefined = 'Netport-Undefined'

## SchToolBarDeviceName

AGND = 'Ground-AGND', BI = 'Netport-BI', CAPACITOR = 'CAP_0603', DIFF_PAIRS_FLAG = 'Differential-Pairs-Flag', DIODE = '1N4007', FOUR_CHANNEL_OSCILLOSCOPE = '四通道示波器', GND = 'Ground-GND', IN = 'Netport-IN', INDUCTOR = 'L_0603', MULTIMETER = '万用表', OFF_PAGE_CONNECTOR_BI = 'Off-Page-Connector-BI', OFF_PAGE_CONNECTOR_IN = 'Off-Page-Connector-In', OFF_PAGE_CONNECTOR_OUT = 'Off-Page-Connector-Out', OUT = 'Netport-OUT', PGND = 'Ground-PGND', PROBE_I = '电流探针', PROBE_L = '逻辑探针', PROBE_V = '电压探针', RESISTOR = 'Res_0603', SHORT = 'Short-Symbol', TEST_POINT = 'Test-Point', V5 = 'Power-5V', VCC = 'Power-VCC'
