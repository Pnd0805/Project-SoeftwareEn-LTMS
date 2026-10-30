import { Banner } from '../../components/kit/primitives'

/** คิวเฉพาะแอดมินมหาวิทยาลัยที่ปฏิเสธสิทธิ์ — เหตุเดียวกันต้องแจ้งเหมือนกันทุกคิว (เอกสารแก้ UI ข้อ 13) */
export function AdminQueueDenied({ error, queue }: { error: unknown; queue: string }) {
  return (
    <Banner kind="crit">
      <b>This queue is for university-wide admins.</b>{' '}
      {(error as { status?: number } | null)?.status === 401 ? 'Sign in again to continue.' : `Your admin scope does not cover ${queue}.`}
    </Banner>
  )
}
