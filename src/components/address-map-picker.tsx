"use client";

import L, { type LatLngExpression } from "leaflet";
import { LocateFixed, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Sheet } from "@/components/sheet";
import { useI18n } from "@/lib/i18n";

type Position = { latitude: number; longitude: number };
export type SelectedAddress = Position & { address: string };

const defaultPosition: Position = {
  latitude: 47.6062,
  longitude: -122.3321,
};

const pinIcon = L.divIcon({
  className: "",
  html: '<div class="map-pin-marker"><span></span></div>',
  iconAnchor: [18, 36],
  iconSize: [36, 36],
});

export function AddressMapPicker({
  kind,
  address,
  disabled,
  onSelect,
}: {
  kind: "home" | "venue";
  address: string;
  disabled?: boolean;
  onSelect: (selection: SelectedAddress) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(defaultPosition);
  const [resolvedAddress, setResolvedAddress] = useState(address);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  async function openPicker() {
    setResolvedAddress("");
    setError("");
    setOpen(true);
    if (address.trim().length < 5) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/geocode?address=${encodeURIComponent(address)}`,
      );
      if (!response.ok) throw new Error(await readMapError(response));
      const result = (await response.json()) as SelectedAddress;
      setPosition(result);
      setResolvedAddress(result.address);
    } catch {
      setError(
        t("We could not locate the typed address. Tap the map to choose it."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function choosePosition(nextPosition: Position) {
    setPosition(nextPosition);
    setResolvedAddress("");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/geocode?lat=${nextPosition.latitude}&lng=${nextPosition.longitude}`,
      );
      if (!response.ok) throw new Error(await readMapError(response));
      const result = (await response.json()) as SelectedAddress;
      setPosition(result);
      setResolvedAddress(result.address);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? t(caught.message)
          : t("Could not find the address."),
      );
    } finally {
      setBusy(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError(t("Location services are not available on this device."));
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (result) =>
        void choosePosition({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        }),
      () => {
        setBusy(false);
        setError(t("Allow location access to use your current position."));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="secondary-button address-map-trigger"
        disabled={disabled}
        onClick={() => void openPicker()}
      >
        <MapPin size={17} />
        {t("Choose with map pin")}
      </button>
      {open && (
        <Sheet
          title={t(
            kind === "home" ? "Choose home location" : "Choose venue location",
          )}
          returnFocus={trigger}
          fullScreen
          busy={busy}
          onClose={() => setOpen(false)}
        >
          <div className="map-picker">
            <p className="map-picker-instructions">
              {t("Tap the map or drag the pin")}
            </p>
            <div className="map-picker-canvas">
              <MapContainer
                center={[position.latitude, position.longitude]}
                zoom={15}
                className="map-picker-map"
                zoomControl
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapInteraction
                  position={position}
                  onSelect={choosePosition}
                />
              </MapContainer>
              <button
                type="button"
                className="map-current-location"
                aria-label={t("Use current location")}
                onClick={useCurrentLocation}
              >
                <LocateFixed />
              </button>
            </div>
            <footer className="map-picker-footer">
              <p>
                {busy
                  ? t("Finding street address…")
                  : resolvedAddress || t("Tap a location on the map.")}
              </p>
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="button"
                className="primary-button"
                disabled={busy || !resolvedAddress}
                onClick={() => {
                  onSelect({ ...position, address: resolvedAddress });
                  setOpen(false);
                }}
              >
                {t("Use this address")}
              </button>
            </footer>
          </div>
        </Sheet>
      )}
    </>
  );
}

function MapInteraction({
  position,
  onSelect,
}: {
  position: Position;
  onSelect: (position: Position) => void;
}) {
  const map = useMap();
  const markerPosition = useMemo<LatLngExpression>(
    () => [position.latitude, position.longitude],
    [position],
  );

  useEffect(() => {
    const resize = () => map.invalidateSize({ animate: false });
    const observer = new ResizeObserver(resize);
    observer.observe(map.getContainer());
    resize();
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    map.setView(markerPosition);
  }, [map, markerPosition]);

  useMapEvents({
    click(event) {
      void onSelect({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  return (
    <Marker
      draggable
      icon={pinIcon}
      position={markerPosition}
      eventHandlers={{
        dragend(event) {
          const next = event.target.getLatLng();
          void onSelect({ latitude: next.lat, longitude: next.lng });
        },
      }}
    />
  );
}

async function readMapError(response: Response) {
  const result = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return result?.error ?? "Could not resolve this location.";
}
