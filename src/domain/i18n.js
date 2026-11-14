// Translations for the literals shown to the user. Pure module: no Vue, no DOM.
//
// The active language lives in `settings.locale`, and every text is requested with
// `t('key', { parameter })`. Keys are flat and prefixed by area ('config.', 'sheet.', 'warning.'...).
// When a key is missing in a language, Spanish is used; if it is missing there too, the key itself
// is returned (it never throws).

export const LOCALES = ['es', 'en'];
export const DEFAULT_LOCALE = 'es';

const es = {
  // ---------- Language ----------
  'language.label': 'Idioma',
  'language.es': 'Castellano',
  'language.en': 'English',

  // ---------- Page and tabs ----------
  'app.title': 'Rota',
  'app.week': 'Semana del {date}',
  'section.config': 'Configuración',
  'section.employees': 'Empleados',
  'section.schedule': 'Horario de la semana',
  'view.aria': 'Vista del horario',
  'view.sheet': 'Hoja',
  'view.edit': 'Edición',

  // ---------- Toolbar ----------
  'toolbar.generate': 'Generar horario',
  'toolbar.clear': 'Vaciar horario',
  'toolbar.print': 'Imprimir',
  'toolbar.export': 'Exportar JSON',
  'toolbar.import': 'Importar JSON',
  'toolbar.reset': 'Restablecer todo',
  'toolbar.exportFilename': 'horario-{week}',

  // ---------- Status bar messages ----------
  'status.noEmployeesGenerate': 'Añade al menos un empleado antes de generar el horario.',
  'status.generated': 'Horario generado. Revisa los avisos y ajusta a mano lo que necesites.',
  'status.cleared': 'Horario vaciado.',
  'status.exported': 'Horario exportado.',
  'status.imported': 'Importado "{name}".',
  'status.readError': 'No se pudo leer el archivo.',
  'status.reset': 'Datos restablecidos.',
  'status.saveFailed': 'No se pudo guardar en el navegador (almacenamiento no disponible).',
  'status.language': 'Idioma cambiado a {language}.',
  'status.weekChanged': 'Semana cambiada al lunes {monday}. Se vació el horario anterior.',
  'status.chooseEmployee': 'Elige un empleado para añadir al turno.',

  // ---------- Confirmations ----------
  'confirm.replaceSchedule': 'Se sustituirá el horario actual, incluidos los cambios manuales. ¿Continuar?',
  'confirm.clearSchedule': '¿Vaciar todas las asignaciones del horario?',
  'confirm.reset': 'Se borrarán empleados, configuración y horario. ¿Continuar?',

  // ---------- Settings ----------
  'config.general': 'General',
  'config.week': 'Semana (lunes)',
  'config.weekHint': 'Si eliges otro día, se ajusta al lunes de esa semana.',
  'config.weeklyCap': 'Límite semanal de horas',
  'config.weeklyCapHint': 'Las ausencias cuentan dentro de este límite. Solo genera avisos.',
  'config.minRestHours': 'Descanso mínimo entre turnos (h)',
  'config.breaks': 'Descansos dentro del turno',
  'config.breaksHint': 'Si una asignación dura más de X horas, incluye un descanso que no cuenta como hora trabajada '
    + '(ni para el empleado ni en el total semanal). Puedes definir varias reglas: se aplica la de mayor número '
    + 'de horas que el turno supere.',
  'config.breaksAfterHours': 'Si el turno dura más de (h)',
  'config.breaksMinutes': 'Descanso (min)',
  'config.breaksAfterHoursAria': 'Horas de la regla de descanso {n}',
  'config.breaksMinutesAria': 'Minutos de la regla de descanso {n}',
  'config.deleteBreakRuleAria': 'Eliminar la regla de descanso {n}',
  'config.addBreakRule': 'Añadir regla de descanso',
  'config.breaksEmpty': 'Sin reglas: ningún turno incluye descanso.',
  'config.daysOff': 'Días libres por empleado',
  'config.daysOffHint': 'Se cuentan entre los días de apertura (los días cerrados no cuentan). '
    + 'Comprueba el mínimo de tu convenio.',
  'config.contractDays': 'Días de trabajo del contrato',
  'config.contractDaysHint': 'Sirve para prorratear las horas de una ausencia por día.',
  'config.openDays': 'Días de apertura',
  'config.categories': 'Categorías de empleado',
  'config.categoriesHint': 'Cuanto mayor el rango, más categoría: una categoría de rango 3 puede cubrir una plaza '
    + 'de rango 2 o 1, pero no al revés.',
  'config.categoriesEmpty': 'No hay categorías: añade al menos una para poder asignar personal.',
  'config.category': 'Categoría',
  'config.rank': 'Rango',
  'config.categoryNameAria': 'Nombre de la categoría',
  'config.categoryRankAria': 'Rango de {name}',
  'config.deleteCategoryAria': 'Eliminar la categoría {name}',
  'config.delete': 'Eliminar',
  'config.addCategory': 'Añadir categoría',
  'config.shiftStart': 'Inicio',
  'config.shiftEnd': 'Fin',
  'config.minimumStaff': 'Personal mínimo',
  'config.categoryOption': '{name} (rango {rank})',
  'config.minimumStaffHint': 'Mínimo por categoría; la de rango mayor puede cubrir plazas de rango menor. '
    + 'Se puede cambiar día a día en la Edición.',
  'config.coverageMode': 'Cómo se define el personal mínimo',
  'config.coverageModeCategories': 'Por categorías',
  'config.coverageModeLeaders': 'Personas y responsables de turno',
  'config.coverageModeHint': 'Por categorías: indicas cuántas personas de cada categoría hacen falta. '
    + 'Personas y responsables de turno: indicas cuántas personas hacen falta y cuántas de ellas deben ser '
    + 'responsables de turno (los empleados que pueden serlo se marcan en la tabla de empleados). '
    + 'Cada modo conserva su configuración al cambiar.',
  'config.categoriesHintLeaders': 'En este modo las categorías son opcionales y solo se muestran: '
    + 'no se usan para cubrir los turnos.',
  'config.categoriesEmptyLeaders': 'No hay categorías. En este modo son opcionales.',
  'config.headcount': 'Personas',
  'config.leaders': 'Responsables de turno',
  'config.leadersHint': 'Los responsables de turno cuentan dentro del total de personas. '
    + 'Se puede cambiar día a día en la Edición.',

  // ---------- Employees ----------
  'employees.empty': 'Aún no hay empleados. Añade el primero para poder generar un horario.',
  'employees.name': 'Nombre',
  'employees.category': 'Categoría (rango)',
  'employees.contract': 'Horas contratadas / semana',
  'employees.absences': 'Ausencias (vacaciones o baja)',
  'employees.blocked': 'Turnos bloqueados (no puede hacerlos)',
  'employees.prevWeek': 'Fin del último turno de la semana anterior (opcional)',
  'employees.add': 'Añadir empleado',
  'employees.needsCategory': 'Antes de añadir empleados necesitas al menos una categoría (por ejemplo, «Camarero»).',
  'employees.createCategory': 'Crear una categoría',
  'employees.nameAria': 'Nombre',
  'employees.categoryAria': 'Categoría de {name}',
  'employees.canLead': 'Responsable de turno',
  'employees.canLeadAria': '{name} puede ser responsable de turno',
  'employees.noCategory': 'Sin categoría',
  'employees.contractAria': 'Horas contratadas semanales',
  'employees.dayTitle': '{day} {date}',
  'employees.absentAll': 'Toda la semana',
  'employees.absentNone': 'Quitar todos',
  'employees.markAllTitle': 'Marcar todos los días de apertura como ausencia',
  'employees.unmarkAllTitle': 'Desmarcar todos los días',
  'employees.blockAria': 'Bloquear un turno de {name}',
  'employees.unblockAria': 'Quitar el bloqueo {shift}',
  'employees.addBlock': '+ bloquear turno',
  'employees.prevWeekAria': 'Fin del último turno de la semana anterior',
  'employees.deleteAria': 'Eliminar a {name}',
  'employees.delete': 'Eliminar',

  // ---------- Summary ----------
  'results.summary': 'Horas planificadas {assigned} h + ausencias {absence} h = {planned} h de un límite de '
    + '{cap} h (contratadas en total: {contract} h).',
  'results.noWarnings': 'Sin avisos: el horario cumple todas las reglas.',
  'results.warnings': 'Avisos ({count})',

  // ---------- Hours per employee ----------
  'hours.title': 'Horas por empleado',
  'hours.employee': 'Empleado',
  'hours.contract': 'Contrato',
  'hours.absences': 'Ausencias',
  'hours.target': 'Objetivo',
  'hours.assigned': 'Asignadas',
  'hours.days': 'Días',

  // ---------- Sheet ----------
  'sheet.addEmployees': 'Añade empleados para ver la hoja de horarios.',
  'sheet.noOpenDays': 'No hay días de apertura configurados.',
  'sheet.hint': 'Pulsa una celda (o Enter) para añadir, cambiar o quitar el turno de esa persona. '
    + 'Pulsa la cabecera de un turno, o su celda de cobertura, para ver su detalle.',
  'sheet.aria': 'Horario semanal por empleado',
  'sheet.employee': 'Empleado',
  'sheet.contract': 'Contrato',
  'sheet.target': 'Objetivo',
  'sheet.assigned': 'Asignadas',
  'sheet.diff': 'Dif.',
  'sheet.hoursRow': 'Horas del turno (netas)',
  'sheet.coverageRow': 'Cobertura (cubierto/mínimo)',
  'sheet.missingTag': 'falta {text}',
  'sheet.legendWork': 'Turno ',
  'sheet.legendAbsent': 'Ausencia ',
  'sheet.legendBlocked': 'Turno bloqueado ',
  'sheet.legendBad': 'Incumple una regla',
  'sheet.legendBreak': 'Incluye descanso (no computa)',
  'sheet.badgeBreak': 'descanso {minutes} min',
  'sheet.breakMark': '{minutes} min',
  'sheet.cellHours': '{hours} h',
  'sheet.badgeBad': 'incumple una regla',
  'sheet.absent': 'Ausente',
  'sheet.blocked': 'Bloqueado',
  'sheet.detailTitle': 'Ver el detalle de {day} {shift}',
  'sheet.describeAbsent': '{name} · {day}: ausente',
  'sheet.describeBlocked': '{name} · {where}: turno bloqueado',
  'sheet.describeEmpty': '{name} · {where}: sin turno',
  'sheet.describeWork': '{name} · {where}: {times} ({hours} h){bad}',
  'sheet.describeWorkBreak': '{name} · {where}: {times} ({hours} h, con {minutes} min de descanso){bad}',
  'sheet.describeBad': ' · incumple una regla',
  'sheet.coverageDetail': '{where}: cubiertas {covered} de {required} plazas{detail}',
  'sheet.removedEmployee': '(eliminado)',
  'sheet.joinAnd': ' y ',
  'sheet.canLeadTitle': 'Puede ser responsable de turno',
  // Coverage classes of the "personas y responsables de turno" mode (they appear in "falta cubrir 1 ...").
  'coverage.leader': 'responsable de turno',
  'coverage.staff': 'personal',

  // ---------- Shift popup ----------
  'shiftPopup.coverage': 'Cobertura: {covered}/{required}{suffix}',
  'shiftPopup.coveredSuffix': ' · cubierto',
  'shiftPopup.missingSuffix': ' · falta {text}',
  'shiftPopup.close': 'Cerrar',

  // ---------- Cell editor ----------
  'cellEditor.fullShift': '{category} · turno completo {start}–{end}',
  'cellEditor.fullShiftNoCategory': 'Turno completo {start}–{end}',
  'cellEditor.totalHours': 'Total en este turno: {hours} h (descansos descontados)',
  'cellEditor.startAria': 'Inicio',
  'cellEditor.endAria': 'Fin',
  'cellEditor.remove': 'Quitar',
  'cellEditor.emptyHint': 'Sin turno. Elige las horas (por defecto, el turno completo) y pulsa «Añadir».',
  'cellEditor.absentReason': 'Está ausente ese día, así que no se le puede asignar. Las ausencias se cambian '
    + 'en la tabla de empleados.',
  'cellEditor.blockedReason': 'Tiene bloqueado este turno, así que no se le puede asignar. Los bloqueos se '
    + 'cambian en la tabla de empleados.',
  'cellEditor.save': 'Guardar',
  'cellEditor.add': 'Añadir',
  'cellEditor.cancel': 'Cancelar',

  // ---------- Edit view ----------
  'edit.day': 'Día',
  'edit.generateShift': 'Generar turno',
  'edit.generateShiftTitle': 'Completa este turno automáticamente (conserva lo ya asignado y no toca el resto)',
  'edit.minimumOf': 'Mínimo de {name} (rango {rank})',
  'edit.minimumAria': 'Mínimo de {name}',
  'edit.headcountShort': 'Pers.',
  'edit.leadersShort': 'Resp.',
  'edit.headcountAria': 'Personas mínimas',
  'edit.leadersAria': 'Responsables de turno mínimos',
  'edit.headcountTitle': 'Personas mínimas del turno (incluye a los responsables)',
  'edit.leadersTitle': 'Responsables de turno mínimos',
  'edit.canLeadMark': 'responsable de turno',
  'edit.absentNote': ' (ausente)',
  'edit.blockedNote': ' (bloqueado)',
  'edit.removeAria': 'Quitar a {name}',
  'edit.startOfAria': 'Inicio de {name}',
  'edit.endOfAria': 'Fin de {name}',
  'edit.employeeAria': 'Empleado',
  'edit.addEmployeeOption': '+ empleado',
  'edit.add': 'Añadir',

  // ---------- Actions ----------
  'actions.endBeforeStart': 'La hora de fin debe ser posterior a la de inicio.',
  'actions.nobodyEligible': 'Nadie más es elegible (ausencias, bloqueos, descanso, días libres u horas '
    + 'contratadas).',
  'actions.noEmployeesShift': 'Añade al menos un empleado antes de generar un turno.',
  'actions.where': '{day} {shift}',
  'actions.alreadyCovered': '{where}: ya cubre el personal mínimo, no hay nada que añadir.',
  'actions.nothingAdded': '{where}: no se pudo añadir a nadie. Falta {missing}. {hint}',
  'actions.addedButMissing': '{where}: añadidos {names}, pero aún falta {missing}. {hint}',
  'actions.added': '{where}: añadidos {names}.',
  'actions.categoryName': 'Categoría {n}',
  'actions.employeeName': 'Empleado {n}',

  // ---------- Import ----------
  'import.notObject': 'El archivo no contiene un horario válido.',
  'import.invalidJson': 'El archivo no es un JSON válido.',

  // ---------- Warnings ----------
  'warning.shiftTimes': 'El turno de {shift} tiene una hora de fin anterior o igual a la de inicio.',
  'warning.noCategories': 'No hay categorías definidas: añade al menos una en la configuración para poder '
    + 'asignar personal.',
  'warning.closed': '{name} está asignado/a un día cerrado o fuera de la semana ({day}).',
  'warning.absent': '{name} está ausente el {day} pero tiene turno asignado.',
  'warning.blocked': '{name} tiene bloqueado el turno de {shift} del {day} pero está asignado/a.',
  'warning.badRange': '{name}: turno con hora de fin anterior o igual a la de inicio ({day}).',
  'warning.unknownEmployee': 'Hay una asignación de un empleado que ya no existe ({day}).',
  'warning.under': '{name}: {assigned} h asignadas de {target} h objetivo (faltan {missing} h).',
  'warning.over': '{name}: {assigned} h asignadas, por encima de las {target} h objetivo.',
  'warning.daysOff': '{name} trabaja {days} días y no respeta los {daysOff} día(s) libre(s) (máximo {max}).',
  'warning.overlap': '{name} tiene turnos solapados el {day}.',
  'warning.rest': '{name}: solo {rest} h de descanso antes del turno del {day} (mínimo {min} h{prevWeek}).',
  'warning.restPrevWeek': ', contando el último turno de la semana anterior',
  'warning.unfilled': '{day} {shift}: falta cubrir {missing} (cubiertas {covered} de {required} plazas).',
  'warning.staff': 'Hay turnos que necesitan {needed} persona(s) de categoría {category} o superior a la vez, '
    + 'pero solo hay {available} empleado(s) así.',
  'warning.staffLeaders': 'Hay turnos que necesitan {needed} responsable(s) de turno a la vez, '
    + 'pero solo hay {available} empleado(s) marcado(s) como responsable de turno.',
  'warning.staffHeadcount': 'Hay turnos que necesitan {needed} persona(s) a la vez, '
    + 'pero solo hay {available} empleado(s).',
  'warning.capContracts': 'Las horas contratadas ({contract} h) superan el límite semanal ({cap} h): '
    + 'no es posible cumplir ambas cosas.',
  'warning.cap': 'Horas planificadas + ausencias ({planned} h) superan el límite semanal ({cap} h).',

  // ---------- Days and shifts ----------
  'day.0': 'Lunes',
  'day.1': 'Martes',
  'day.2': 'Miércoles',
  'day.3': 'Jueves',
  'day.4': 'Viernes',
  'day.5': 'Sábado',
  'day.6': 'Domingo',
  'day.lower.0': 'lunes',
  'day.lower.1': 'martes',
  'day.lower.2': 'miércoles',
  'day.lower.3': 'jueves',
  'day.lower.4': 'viernes',
  'day.lower.5': 'sábado',
  'day.lower.6': 'domingo',
  'day.short.0': 'L',
  'day.short.1': 'M',
  'day.short.2': 'X',
  'day.short.3': 'J',
  'day.short.4': 'V',
  'day.short.5': 'S',
  'day.short.6': 'D',
  'shift.morning': 'Mañana',
  'shift.afternoon': 'Tarde',
  'shift.lower.morning': 'mañana',
  'shift.lower.afternoon': 'tarde',
};

const en = {
  // ---------- Language ----------
  'language.label': 'Language',
  'language.es': 'Castellano',
  'language.en': 'English',

  // ---------- Page and tabs ----------
  'app.title': 'Rota',
  'app.week': 'Week of {date}',
  'section.config': 'Settings',
  'section.employees': 'Employees',
  'section.schedule': 'Weekly schedule',
  'view.aria': 'Schedule view',
  'view.sheet': 'Sheet',
  'view.edit': 'Edit',

  // ---------- Toolbar ----------
  'toolbar.generate': 'Generate schedule',
  'toolbar.clear': 'Clear schedule',
  'toolbar.print': 'Print',
  'toolbar.export': 'Export JSON',
  'toolbar.import': 'Import JSON',
  'toolbar.reset': 'Reset all',
  'toolbar.exportFilename': 'schedule-{week}',

  // ---------- Status bar ----------
  'status.noEmployeesGenerate': 'Add at least one employee before generating the schedule.',
  'status.generated': 'Schedule generated. Review the warnings and adjust what you need by hand.',
  'status.cleared': 'Schedule cleared.',
  'status.exported': 'Schedule exported.',
  'status.imported': 'Imported "{name}".',
  'status.readError': 'The file could not be read.',
  'status.reset': 'Data reset.',
  'status.saveFailed': 'Could not save in the browser (storage unavailable).',
  'status.language': 'Language changed to {language}.',
  'status.weekChanged': 'Week changed to Monday {monday}. The previous schedule was cleared.',
  'status.chooseEmployee': 'Choose an employee to add to the shift.',

  // ---------- Confirmations ----------
  'confirm.replaceSchedule': 'The current schedule, including manual changes, will be replaced. Continue?',
  'confirm.clearSchedule': 'Clear all assignments in the schedule?',
  'confirm.reset': 'Employees, settings and schedule will be deleted. Continue?',

  // ---------- Settings ----------
  'config.general': 'General',
  'config.week': 'Week (Monday)',
  'config.weekHint': 'If you pick another day, it switches to the Monday of that week.',
  'config.weeklyCap': 'Weekly hours limit',
  'config.weeklyCapHint': 'Absences count towards this limit. It only produces warnings.',
  'config.minRestHours': 'Minimum rest between shifts (h)',
  'config.breaks': 'Breaks within the shift',
  'config.breaksHint': 'If an assignment lasts more than X hours, it includes a break that does not count as worked '
    + 'time (neither for the employee nor in the weekly total). You can define several rules: the one with the '
    + 'highest number of hours that the shift exceeds is applied.',
  'config.breaksAfterHours': 'If the shift lasts more than (h)',
  'config.breaksMinutes': 'Break (min)',
  'config.breaksAfterHoursAria': 'Hours of break rule {n}',
  'config.breaksMinutesAria': 'Minutes of break rule {n}',
  'config.deleteBreakRuleAria': 'Delete break rule {n}',
  'config.addBreakRule': 'Add break rule',
  'config.breaksEmpty': 'No rules: no shift includes a break.',
  'config.daysOff': 'Days off per employee',
  'config.daysOffHint': 'Counted among the opening days (closed days do not count). '
    + 'Check the minimum in your collective agreement.',
  'config.contractDays': 'Contract working days',
  'config.contractDaysHint': 'Used to prorate the hours of one day of absence.',
  'config.openDays': 'Opening days',
  'config.categories': 'Employee categories',
  'config.categoriesHint': 'The higher the rank, the higher the category: a rank 3 category can fill a '
    + 'rank 2 or 1 place, but not the other way round.',
  'config.categoriesEmpty': 'There are no categories yet: add at least one to assign staff.',
  'config.category': 'Category',
  'config.rank': 'Rank',
  'config.categoryNameAria': 'Category name',
  'config.categoryRankAria': 'Rank of {name}',
  'config.deleteCategoryAria': 'Delete the category {name}',
  'config.delete': 'Delete',
  'config.addCategory': 'Add category',
  'config.shiftStart': 'Start',
  'config.shiftEnd': 'End',
  'config.minimumStaff': 'Minimum staff',
  'config.categoryOption': '{name} (rank {rank})',
  'config.minimumStaffHint': 'Minimum per category; a higher rank can fill lower-rank places. '
    + 'It can be changed day by day in Edit.',
  'config.coverageMode': 'How minimum staff is defined',
  'config.coverageModeCategories': 'By category',
  'config.coverageModeLeaders': 'Headcount and shift leaders',
  'config.coverageModeHint': 'By category: you set how many people of each category are needed. '
    + 'Headcount and shift leaders: you set how many people are needed and how many of them must be shift '
    + 'leaders (mark who can be one in the employees table). Each mode keeps its own settings when you switch.',
  'config.categoriesHintLeaders': 'In this mode categories are optional and only displayed: '
    + 'they are not used to cover shifts.',
  'config.categoriesEmptyLeaders': 'There are no categories. They are optional in this mode.',
  'config.headcount': 'People',
  'config.leaders': 'Shift leaders',
  'config.leadersHint': 'Shift leaders count within the total number of people. '
    + 'It can be changed day by day in Edit.',

  // ---------- Employees ----------
  // ---------- Employees ----------
  'employees.empty': 'There are no employees yet. Add the first one to generate a schedule.',
  'employees.name': 'Name',
  'employees.category': 'Category (rank)',
  'employees.contract': 'Contracted hours / week',
  'employees.absences': 'Absences (holidays or sick leave)',
  'employees.blocked': 'Blocked shifts (cannot work them)',
  'employees.prevWeek': 'End of the last shift of the previous week (optional)',
  'employees.add': 'Add employee',
  'employees.needsCategory': 'Before adding employees you need at least one category (for example, "Waiter").',
  'employees.createCategory': 'Create a category',
  'employees.nameAria': 'Name',
  'employees.categoryAria': 'Category of {name}',
  'employees.canLead': 'Shift leader',
  'employees.canLeadAria': '{name} can be a shift leader',
  'employees.noCategory': 'No category',
  'employees.contractAria': 'Weekly contracted hours',
  'employees.dayTitle': '{day} {date}',
  'employees.absentAll': 'Whole week',
  'employees.absentNone': 'Clear all',
  'employees.markAllTitle': 'Mark every opening day as absence',
  'employees.unmarkAllTitle': 'Clear all days',
  'employees.blockAria': 'Block a shift of {name}',
  'employees.unblockAria': 'Remove the block {shift}',
  'employees.addBlock': '+ block shift',
  'employees.prevWeekAria': 'End of the last shift of the previous week',
  'employees.deleteAria': 'Delete {name}',
  'employees.delete': 'Delete',

  // ---------- Summary ----------
  'results.summary': 'Planned hours {assigned} h + absences {absence} h = {planned} h out of a {cap} h '
    + 'limit (total contracted: {contract} h).',
  'results.noWarnings': 'No warnings: the schedule follows every rule.',
  'results.warnings': 'Warnings ({count})',

  // ---------- Hours ----------
  'hours.title': 'Hours per employee',
  'hours.employee': 'Employee',
  'hours.contract': 'Contract',
  'hours.absences': 'Absences',
  'hours.target': 'Target',
  'hours.assigned': 'Assigned',
  'hours.days': 'Days',

  // ---------- Sheet ----------
  'sheet.addEmployees': 'Add employees to see the schedule sheet.',
  'sheet.noOpenDays': 'No opening days are configured.',
  'sheet.hint': "Click a cell (or press Enter) to add, change or remove that person's shift. "
    + 'Click a shift header, or its coverage cell, to see its detail.',
  'sheet.aria': 'Weekly schedule per employee',
  'sheet.employee': 'Employee',
  'sheet.contract': 'Contract',
  'sheet.target': 'Target',
  'sheet.assigned': 'Assigned',
  'sheet.diff': 'Diff.',
  'sheet.hoursRow': 'Shift hours (net)',
  'sheet.coverageRow': 'Coverage (covered/minimum)',
  'sheet.missingTag': 'missing {text}',
  'sheet.legendWork': 'Shift ',
  'sheet.legendAbsent': 'Absence ',
  'sheet.legendBlocked': 'Blocked shift ',
  'sheet.legendBad': 'Breaks a rule',
  'sheet.legendBreak': 'Includes a break (not counted)',
  'sheet.badgeBreak': '{minutes} min break',
  'sheet.breakMark': '{minutes} min',
  'sheet.cellHours': '{hours} h',
  'sheet.badgeBad': 'breaks a rule',
  'sheet.absent': 'Absent',
  'sheet.blocked': 'Blocked',
  'sheet.detailTitle': 'See the detail of {day} {shift}',
  'sheet.describeAbsent': '{name} · {day}: absent',
  'sheet.describeBlocked': '{name} · {where}: blocked shift',
  'sheet.describeEmpty': '{name} · {where}: no shift',
  'sheet.describeWork': '{name} · {where}: {times} ({hours} h){bad}',
  'sheet.describeWorkBreak': '{name} · {where}: {times} ({hours} h, including a {minutes} min break){bad}',
  'sheet.describeBad': ' · breaks a rule',
  'sheet.coverageDetail': '{where}: {covered} of {required} places covered{detail}',
  'sheet.removedEmployee': '(deleted)',
  'sheet.joinAnd': ' and ',
  'sheet.canLeadTitle': 'Can be a shift leader',
  // Coverage classes of the "headcount and shift leaders" mode (they appear in "still missing 1 ...").
  'coverage.leader': 'shift leader',
  'coverage.staff': 'staff',

  // ---------- Shift popup ----------
  'shiftPopup.coverage': 'Coverage: {covered}/{required}{suffix}',
  'shiftPopup.coveredSuffix': ' · covered',
  'shiftPopup.missingSuffix': ' · missing {text}',
  'shiftPopup.close': 'Close',

  // ---------- Cell editor ----------
  'cellEditor.fullShift': '{category} · full shift {start}–{end}',
  'cellEditor.fullShiftNoCategory': 'Full shift {start}–{end}',
  'cellEditor.totalHours': 'Total in this shift: {hours} h (breaks subtracted)',
  'cellEditor.startAria': 'Start',
  'cellEditor.endAria': 'End',
  'cellEditor.remove': 'Remove',
  'cellEditor.emptyHint': 'No shift. Pick the times (the full shift by default) and press "Add".',
  'cellEditor.absentReason': 'They are absent that day, so no shift can be assigned. Absences are changed '
    + 'in the employees table.',
  'cellEditor.blockedReason': 'They have this shift blocked, so no shift can be assigned. Blocks are '
    + 'changed in the employees table.',
  'cellEditor.save': 'Save',
  'cellEditor.add': 'Add',
  'cellEditor.cancel': 'Cancel',

  // ---------- Edit view ----------
  'edit.day': 'Day',
  'edit.generateShift': 'Generate shift',
  'edit.generateShiftTitle': 'Completes this shift automatically (keeps what is already assigned and leaves '
    + 'the rest alone)',
  'edit.minimumOf': 'Minimum of {name} (rank {rank})',
  'edit.minimumAria': 'Minimum of {name}',
  'edit.headcountShort': 'People',
  'edit.leadersShort': 'Lead.',
  'edit.headcountAria': 'Minimum people',
  'edit.leadersAria': 'Minimum shift leaders',
  'edit.headcountTitle': 'Minimum people in the shift (shift leaders included)',
  'edit.leadersTitle': 'Minimum shift leaders',
  'edit.canLeadMark': 'shift leader',
  'edit.absentNote': ' (absent)',
  'edit.blockedNote': ' (blocked)',
  'edit.removeAria': 'Remove {name}',
  'edit.startOfAria': 'Start of {name}',
  'edit.endOfAria': 'End of {name}',
  'edit.employeeAria': 'Employee',
  'edit.addEmployeeOption': '+ employee',
  'edit.add': 'Add',

  // ---------- Actions ----------
  'actions.endBeforeStart': 'The end time must be later than the start time.',
  'actions.nobodyEligible': 'Nobody else is eligible (absences, blocks, rest, days off or contracted hours).',
  'actions.noEmployeesShift': 'Add at least one employee before generating a shift.',
  'actions.where': '{day} {shift}',
  'actions.alreadyCovered': '{where}: it already meets the minimum staff, nothing to add.',
  'actions.nothingAdded': '{where}: nobody could be added. Missing {missing}. {hint}',
  'actions.addedButMissing': '{where}: added {names}, but still missing {missing}. {hint}',
  'actions.added': '{where}: added {names}.',
  'actions.categoryName': 'Category {n}',
  'actions.employeeName': 'Employee {n}',

  // ---------- Import ----------
  'import.notObject': 'The file does not contain a valid schedule.',
  'import.invalidJson': 'The file is not valid JSON.',

  // ---------- Warnings ----------
  'warning.shiftTimes': 'The {shift} shift ends at or before it starts.',
  'warning.noCategories': 'No categories defined: add at least one in the settings to assign staff.',
  'warning.closed': '{name} is assigned to a closed day or outside the week ({day}).',
  'warning.absent': '{name} is absent on {day} but has a shift assigned.',
  'warning.blocked': '{name} has the {shift} shift blocked on {day} but is assigned to it.',
  'warning.badRange': '{name}: shift that ends at or before it starts ({day}).',
  'warning.unknownEmployee': 'There is an assignment for an employee that no longer exists ({day}).',
  'warning.under': '{name}: {assigned} h assigned out of a {target} h target ({missing} h short).',
  'warning.over': '{name}: {assigned} h assigned, above the {target} h target.',
  'warning.daysOff': '{name} works {days} days and does not respect the {daysOff} day(s) off (max {max}).',
  'warning.overlap': '{name} has overlapping shifts on {day}.',
  'warning.rest': '{name}: only {rest} h of rest before the shift on {day} (minimum {min} h{prevWeek}).',
  'warning.restPrevWeek': ', counting the last shift of the previous week',
  'warning.unfilled': '{day} {shift}: still missing {missing} (covered {covered} of {required} places).',
  'warning.staff': 'Some shifts need {needed} person(s) of category {category} or higher at the same time, '
    + 'but there are only {available} such employee(s).',
  'warning.staffLeaders': 'Some shifts need {needed} shift leader(s) at the same time, '
    + 'but only {available} employee(s) are marked as shift leaders.',
  'warning.staffHeadcount': 'Some shifts need {needed} person(s) at the same time, '
    + 'but there are only {available} employee(s).',
  'warning.capContracts': 'Contracted hours ({contract} h) exceed the weekly limit ({cap} h): '
    + 'it is not possible to meet both.',
  'warning.cap': 'Planned hours + absences ({planned} h) exceed the weekly limit ({cap} h).',

  // ---------- Days and shifts ----------
  'day.0': 'Monday',
  'day.1': 'Tuesday',
  'day.2': 'Wednesday',
  'day.3': 'Thursday',
  'day.4': 'Friday',
  'day.5': 'Saturday',
  'day.6': 'Sunday',
  'day.lower.0': 'monday',
  'day.lower.1': 'tuesday',
  'day.lower.2': 'wednesday',
  'day.lower.3': 'thursday',
  'day.lower.4': 'friday',
  'day.lower.5': 'saturday',
  'day.lower.6': 'sunday',
  'day.short.0': 'M',
  'day.short.1': 'T',
  'day.short.2': 'W',
  'day.short.3': 'T',
  'day.short.4': 'F',
  'day.short.5': 'S',
  'day.short.6': 'S',
  'shift.morning': 'Morning',
  'shift.afternoon': 'Afternoon',
  'shift.lower.morning': 'morning',
  'shift.lower.afternoon': 'afternoon',
};

/** Catalog for each language. */
export const MESSAGES = { es, en };

/** @returns {boolean} true if `locale` is a supported language. */
export function isLocale(locale) {
  return LOCALES.includes(locale);
}

/** Supported languages as selector options: [{ id, name }]. */
export function localeOptions(locale) {
  return LOCALES.map((id) => ({ id, name: translate(locale, `language.${id}`) }));
}

/** Replaces the `{name}` placeholders of a template. */
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/**
 * Text of a key in a language. If the key is missing, Spanish is used; as a last resort, the key.
 * @param {string} locale Language ('es' | 'en'); any other value uses the default language.
 * @param {string} key Catalog key.
 * @param {Object<string, *>} [params] Values for the `{name}` placeholders.
 * @returns {string}
 */
export function translate(locale, key, params) {
  const catalog = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  const template = catalog[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
  return interpolate(template, params);
}

/**
 * Translator for a language: `t('key', { parameter })`.
 * @param {string} locale
 * @returns {(key: string, params?: Object<string, *>) => string}
 */
export function createTranslator(locale) {
  return (key, params) => translate(locale, key, params);
}

/** Long day name (0 = Monday ... 6 = Sunday) in a language. */
export function dayName(locale, dayIndex) {
  return translate(locale, `day.${dayIndex}`);
}

/** Short day name (0 = Monday ... 6 = Sunday) in a language. */
export function dayShort(locale, dayIndex) {
  return translate(locale, `day.short.${dayIndex}`);
}

/** Shift name as is ("Morning"). */
export function shiftLabel(locale, shiftKey) {
  return translate(locale, `shift.${shiftKey}`);
}

/** Lower-case shift name, for use inside a sentence ("morning"). */
export function shiftLabelLower(locale, shiftKey) {
  return translate(locale, `shift.lower.${shiftKey}`);
}
