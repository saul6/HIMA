type LogoTheme = 'light' | 'dark'

export function MadyLogo({
  theme = 'light',
  className,
  style,
  ...rest
}: {
  theme?: LogoTheme
  className?: string
  style?: React.CSSProperties
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'className' | 'style'>) {
  // Selecciona la imagen de public/images según el tema
  const logoSrc = theme === 'dark' 
    ? '/images/MADYOscuro.png'  // Cambia por el nombre exacto de tu archivo
    : '/images/MADY.png' // o '/images/logo.png' si solo tienes uno

  return (
    <img
      src={logoSrc}
      alt="Logo M.A.D.Y"
      {...rest}
      className={className}
      style={{
        objectFit: 'contain',
        ...style,
      }}
    />
  )
}