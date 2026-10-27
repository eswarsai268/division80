import { Capacitor, registerPlugin } from "@capacitor/core";

const NativeThermalPrinter = registerPlugin("ThermalPrinter");
const PRINT_BATCH_SIZE = 5;
const PAPER_DOTS = 384;

export function getVoterSlipContent(record, household) {
  return {
    fields: [
      ["S.No.", record.rollSerial],
      ["Name", record.fullName],
      ["Father / husband", record.fatherOrHusbandName],
      ["Door number", household.houseCode],
      ["Voter ID", record.voterId],
      ["Booth number", household.boothCode],
    ].map(([label, value]) => ({ label, value: value == null || value === "" ? "—" : String(value) })),
    summary: [record.relation, record.age == null ? null : `${record.age} years`, record.gender].filter(Boolean),
  };
}

export function isAndroidNative() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function getPairedThermalPrinters() {
  if (!isAndroidNative()) throw new Error("Direct Bluetooth printing is available in the Android app.");
  const result = await NativeThermalPrinter.getPairedDevices();
  return result.devices ?? [];
}

export async function openBluetoothSettings() {
  if (!isAndroidNative()) throw new Error("Bluetooth settings are only available in the Android app.");
  await NativeThermalPrinter.openBluetoothSettings();
}

function wrapText(context, value, maxWidth) {
  const words = String(value || "—").split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawLabelValue(context, label, value, y, maxWidth) {
  context.font = "16px Arial, sans-serif";
  context.fillStyle = "#333";
  context.fillText(label, 16, y);
  y += 24;

  context.font = "bold 22px Arial, sans-serif";
  context.fillStyle = "#000";
  const lines = wrapText(context, value, maxWidth);
  for (const line of lines) {
    context.fillText(line, 16, y);
    y += 27;
  }
  return y + 8;
}

async function renderVoterSlip(record, household) {
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = PAPER_DOTS;
  canvas.height = 1600;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This browser cannot prepare a printer image.");

  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000";
  context.textBaseline = "top";
  let y = 18;
  context.font = "bold 25px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("VOTER DETAILS", PAPER_DOTS / 2, y);
  context.textAlign = "left";
  y += 42;
  context.fillRect(16, y, PAPER_DOTS - 32, 2);
  y += 16;

  const maxWidth = PAPER_DOTS - 32;
  const content = getVoterSlipContent(record, household);
  for (const field of content.fields) y = drawLabelValue(context, field.label, field.value, y, maxWidth);

  context.fillRect(16, y, PAPER_DOTS - 32, 2);
  y += 16;
  context.font = "16px Arial, sans-serif";
  if (content.summary.length) {
    const summary = content.summary.join(" · ");
    for (const line of wrapText(context, summary, maxWidth)) {
      context.fillText(line, 16, y);
      y += 21;
    }
  }

  if (y > canvas.height) throw new Error("This voter slip is too long to print safely.");
  const trimmed = document.createElement("canvas");
  trimmed.width = PAPER_DOTS;
  trimmed.height = Math.max(1, Math.ceil(y + 12));
  const trimmedContext = trimmed.getContext("2d", { alpha: false });
  if (!trimmedContext) throw new Error("This browser cannot prepare a printer image.");
  trimmedContext.fillStyle = "#fff";
  trimmedContext.fillRect(0, 0, trimmed.width, trimmed.height);
  trimmedContext.drawImage(canvas, 0, 0);
  return trimmed.toDataURL("image/png");
}

export async function printVoterSlips(printerAddress, records, household) {
  for (let index = 0; index < records.length; index += PRINT_BATCH_SIZE) {
    const images = await Promise.all(records.slice(index, index + PRINT_BATCH_SIZE).map(async (record) => ({ data: await renderVoterSlip(record, household) })));
    await NativeThermalPrinter.printImages({ address: printerAddress, images });
  }
}
