import { useState, type CSSProperties } from 'react'

type AvatarProps = {
  name: string
  avatarUrl?: string | null
  size?: number
  alt?: string
  style?: CSSProperties
}

/** URL สาธารณะจาก API ใช้ได้ตรง ๆ; key ดิบหรือรูปที่เปิดไม่ได้กลับไปใช้ตัวอักษรย่อ */
export function Avatar({ name, avatarUrl, size = 24, alt = '', style }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const imageUrl = avatarUrl && (/^https?:\/\//i.test(avatarUrl)
    || (avatarUrl.startsWith('/') && !avatarUrl.startsWith('//')) || avatarUrl.startsWith('data:image/'))
    ? avatarUrl : null
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42, overflow: 'hidden', ...style }}>
    {imageUrl && imageUrl !== failedUrl
      ? <img src={imageUrl} alt={alt} onError={() => setFailedUrl(imageUrl)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : (name.trim().slice(0, 1) || '?')}
  </span>
}
