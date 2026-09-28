// OWNER: Curriculum agent.
// The A1 course. Content is authored compactly in ./units/*.ts (see
// ./builder.ts for the format) and assembled here into the shared Course shape.
import type { Course } from '../types'
import { buildCourse } from './builder'
import { u01 } from './units/u01'
import { u02 } from './units/u02'
import { u03 } from './units/u03'
import { u04 } from './units/u04'
import { u05 } from './units/u05'
import { u06 } from './units/u06'
import { u07 } from './units/u07'
import { u08 } from './units/u08'
import { u09 } from './units/u09'
import { u10 } from './units/u10'
import { u11 } from './units/u11'
import { u12 } from './units/u12'
import { u13 } from './units/u13'
import { u14 } from './units/u14'
import { u15 } from './units/u15'

export const course: Course = buildCourse([u01, u02, u03, u04, u05, u06, u07, u08, u09, u10, u11, u12, u13, u14, u15])
