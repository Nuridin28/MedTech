import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface MapPin {
  id: string
  name: string
  lat: number
  lng: number
  /** small label rendered inside the marker (e.g. price or initial) */
  badge?: string
  /** marker accent colour */
  color?: string
  /** popup HTML body */
  popupHtml?: string
}

/**
 * Leaflet map (TZ §3.4). Uses CSS DivIcon markers so there are no broken default
 * marker images under a bundler, and fits the viewport to all pins.
 */
export function MapView({
  pins,
  height = 420,
  className,
}: {
  pins: MapPin[]
  height?: number
  className?: string
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  // init once
  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, { scrollWheelZoom: false, attributionControl: true }).setView(
      [48.0, 68.0],
      5,
    )
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  // redraw pins on change
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const valid = pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    if (valid.length === 0) return

    const latlngs: [number, number][] = []
    for (const p of valid) {
      const color = p.color ?? '#0052cc'
      const icon = L.divIcon({
        className: 'msp-pin',
        html:
          `<div style="background:${color};color:#fff;min-width:26px;height:26px;padding:0 7px;` +
          `border-radius:13px;display:flex;align-items:center;justify-content:center;` +
          `font:600 11px/1 system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.4);` +
          `border:2px solid #fff;white-space:nowrap">${p.badge ?? ''}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      })
      const marker = L.marker([p.lat, p.lng], { icon, title: p.name }).addTo(layer)
      if (p.popupHtml) marker.bindPopup(p.popupHtml)
      latlngs.push([p.lat, p.lng])
    }
    if (latlngs.length === 1) {
      map.setView(latlngs[0], 14)
    } else {
      map.fitBounds(L.latLngBounds(latlngs).pad(0.2))
    }
    // Leaflet needs a nudge when its container was just resized/shown.
    setTimeout(() => map.invalidateSize(), 60)
  }, [pins])

  return <div ref={elRef} className={className} style={{ height, width: '100%', borderRadius: 12 }} />
}
