// Match the existing uploaded-image overlay without altering its appearance.
export function imageTextTheme(pixels, width, height) {
  let luminance = 0
  for (let y = 0; y < height; y += 1) {
    const opacity = 0.28 + 0.14 * y / Math.max(1, height - 1)
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const channels = [0, 1, 2].map((channel) => {
        const alpha = pixels[index + 3] / 255
        const base = pixels[index + channel] * alpha + [20, 32, 51][channel] * (1 - alpha)
        const value = (base * (1 - opacity) + [8, 15, 29][channel] * opacity) / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      luminance += channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }
  }
  return luminance / (width * height) > 0.179 ? 'dark' : 'light'
}

export function readImageTextTheme(url) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 32
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0, 32, 32)
        resolve(imageTextTheme(context.getImageData(0, 0, 32, 32).data, 32, 32))
      } catch { resolve('light') }
    }
    image.onerror = () => resolve('light')
    image.src = url
  })
}
