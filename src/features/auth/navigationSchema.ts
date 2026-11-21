import { z } from 'zod'

export const navigationSchema = z.strictObject({
  student: z.boolean(),
  employee: z.boolean(),
  crm: z.boolean(),
  crmAssignments: z.boolean(),
  privacy: z.boolean(),
  enrolments: z.boolean(),
  content: z.boolean(),
  distribution: z.boolean(),
  reviews: z.boolean(),
  closeout: z.boolean(),
  classes: z.boolean(),
  curriculumImpact: z.boolean(),
  batches: z.boolean(),
  batchAssign: z.boolean(),
  studentLogins: z.boolean(),
  studentLoginRevoke: z.boolean(),
  courses: z.boolean(),
  payments: z.boolean(),
  paymentLedger: z.boolean(),
  employees: z.boolean(),
  studentRecovery: z.boolean(),
  staffRecovery: z.boolean(),
})
export type NavigationAccess = z.infer<typeof navigationSchema>
