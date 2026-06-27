import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'

export interface MapPin {
  id: string
  name: string
  lat: number
  lng: number
  /** small label rendered inside the marker (e.g. price). Omit for a plain location dot. */
  badge?: string
  /** marker accent colour */
  color?: string
  /** popup HTML body */
  popupHtml?: string
}

const ACCENT = '#0052cc'

/** Cluster bubble: the number shown is the count of clinics in the area; it splits on zoom-in. */
function clusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount()
  // size grows with density so dense areas read as "bigger"
  const size = count < 10 ? 38 : count < 30 ? 46 : count < 100 ? 54 : 62
  const inner = size - 10
  return L.divIcon({
    className: 'msp-cluster',
    html:
      `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;` +
      `justify-content:center;border-radius:50%;background:rgba(0,82,204,.16);` +
      `transform:translate(-50%,-50%)">` +
      `<div style="width:${inner}px;height:${inner}px;border-radius:50%;background:${ACCENT};` +
      `color:#fff;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;` +
      `font:700 ${count > 99 ? 12 : 14}px/1 system-ui,sans-serif;` +
      `box-shadow:0 3px 10px rgba(0,82,204,.45)">${count}</div></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function markerIcon(pin: MapPin) {
  const color = pin.color ?? ACCENT
  if (pin.badge) {
    // labelled marker (e.g. a price) — a rounded pill that sizes to its content
    return L.divIcon({
      className: 'msp-pin',
      html:
        `<div style="transform:translate(-50%,-50%);display:inline-flex;align-items:center;` +
        `background:${color};color:#fff;height:24px;padding:0 9px;border-radius:12px;` +
        `font:700 11px/1 system-ui,sans-serif;white-space:nowrap;border:2px solid #fff;` +
        `box-shadow:0 2px 7px rgba(0,0,0,.28)">${pin.badge}</div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    })
  }
  // plain location dot
  return L.divIcon({
    className: 'msp-pin',
    html:
      `<div style="transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;` +
      `background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/**
 * Leaflet map (TZ §3.4). Markers are grouped into clusters whose number is the count of
 * clinics in that area; clusters split apart as you zoom in. Uses CSS DivIcon markers so
 * there are no broken default marker images under a bundler, and fits the viewport to all pins.
 */
export function MapView({
  pins,
  height = 420,
  className,
  cluster = true,
}: {
  pins: MapPin[]
  height?: number
  className?: string
  /** group nearby markers into count bubbles (default true) */
  cluster?: boolean
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
    // CARTO Voyager basemap — softer, more legible than raw OSM tiles
    L.tileLayer('https://{s}.basemap.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '© OpenStreetMap, © CARTO',
    }).addTo(map)
    layerRef.current = cluster
      ? (L as any)
          .markerClusterGroup({
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            maxClusterRadius: 56,
            chunkedLoading: true,
            iconCreateFunction: clusterIcon,
          })
          .addTo(map)
      : L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const marker = L.marker([p.lat, p.lng], { icon: markerIcon(p), title: p.name })
      if (p.popupHtml) marker.bindPopup(p.popupHtml)
      layer.addLayer(marker)
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
