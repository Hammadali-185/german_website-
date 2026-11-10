"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getItemById } from "@/content/menu";
import {
  fees,
  paymentMethods,
  selectionLabels,
  type PaymentMethodId,
} from "@/content/ordering";
import { useCart } from "@/components/cart-context";
import { Price } from "@/components/Price";
import { lineTotalCents } from "@/lib/cart";
import { formatEuro } from "@/lib/format";
import {
  createOrderNumber,
  validateCheckout,
  type CheckoutErrors,
  type CheckoutInput,
  type Fulfillment,
} from "@/lib/checkout";
import styles from "./Checkout.module.css";

type ReceiptLine = {
  name: string;
  quantity: number;
  detail: string;
  totalCents: number;
};

type Receipt = {
  number: string;
  name: string;
  phone: string;
  fulfillment: Fulfillment;
  address: string;
  payment: string;
  notes: string;
  lines: ReceiptLine[];
  subtotalCents: number;
  feeCents: number;
  totalCents: number;
};

const emptyInput: CheckoutInput = {
  fulfillment: "",
  name: "",
  phone: "",
  street: "",
  houseNumber: "",
  postalCode: "",
  city: "",
  notes: "",
  payment: "",
};

export function Checkout() {
  const { lines, subtotalCents, clearCart } = useCart();
  const [input, setInput] = useState<CheckoutInput>(emptyInput);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const shouldFocusErrors = useRef(false);

  useEffect(() => {
    if (!shouldFocusErrors.current || !errorRef.current) return;
    shouldFocusErrors.current = false;
    errorRef.current.focus();
  });

  if (receipt) {
    return <Confirmation receipt={receipt} />;
  }

  if (lines.length === 0) {
    return (
      <section className={`wrap ${styles.page}`}>
        <p className={styles.kicker}>Kasse</p>
        <h1>Noch nichts im Warenkorb.</h1>
        <p className={styles.lead}>
          Such dir zuerst ein Gericht aus. Die Kasse rechnet nur, was wirklich
          im Warenkorb liegt.
        </p>
        <Link href="/speisekarte" className={styles.primary}>
          Zur Speisekarte
        </Link>
      </section>
    );
  }

  const feeCents =
    input.fulfillment === "lieferung" ? fees.deliveryCents : fees.pickupCents;
  const totalCents = subtotalCents + feeCents;
  const errorList = Object.values(errors);

  function update<Key extends keyof CheckoutInput>(key: Key, value: CheckoutInput[Key]) {
    setInput((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key] && key !== "fulfillment") return current;
      const next = { ...current };
      delete next[key];
      if (key === "fulfillment" && value !== "lieferung") {
        delete next.street;
        delete next.houseNumber;
        delete next.postalCode;
        delete next.city;
      }
      return next;
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateCheckout(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      shouldFocusErrors.current = true;
      return;
    }

    const fulfillment = input.fulfillment as Fulfillment;
    const payment = paymentMethods.find((method) => method.id === input.payment);
    setReceipt({
      number: createOrderNumber(),
      name: input.name.trim(),
      phone: input.phone.trim(),
      fulfillment,
      address:
        fulfillment === "lieferung"
          ? `${input.street.trim()} ${input.houseNumber.trim()}, ${input.postalCode.trim()} ${input.city.trim()}`
          : "Abholung an der Theke",
      payment: payment?.name ?? "",
      notes: input.notes.trim(),
      lines: lines.map((line) => {
        const item = getItemById(line.itemId);
        const detail = [...selectionLabels(item, line.selection)];
        if (line.note) detail.push(line.note);
        return {
          name: item.name,
          quantity: line.quantity,
          detail: detail.join(" · "),
          totalCents: lineTotalCents(line),
        };
      }),
      subtotalCents,
      feeCents: fulfillment === "lieferung" ? fees.deliveryCents : fees.pickupCents,
      totalCents:
        subtotalCents +
        (fulfillment === "lieferung" ? fees.deliveryCents : fees.pickupCents),
    });
    clearCart();
  }

  return (
    <section className={`wrap ${styles.page}`}>
      <p className={styles.kicker}>Demo-Kasse</p>
      <h1>Bestellung prüfen.</h1>
      <p className={styles.lead}>
        Es wird nichts an ein Restaurant geschickt und nichts bezahlt. Die
        Bestätigung zeigt nur, wie der Abschluss aussehen würde.
      </p>

      <form className={styles.layout} onSubmit={submit} noValidate>
        <div className={styles.form}>
          {errorList.length > 0 ? (
            <div ref={errorRef} tabIndex={-1} className={styles.alert} role="alert">
              <p>Bitte noch ergänzen:</p>
              <ul>
                {errorList.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <fieldset className={styles.group}>
            <legend>Wie willst du es bekommen?</legend>
            <div className={styles.switch}>
              <FulfillmentOption
                value="abholung"
                current={input.fulfillment}
                title="Abholung"
                detail="An der Theke, ohne Lieferkosten"
                onChange={(value) => update("fulfillment", value)}
              />
              <FulfillmentOption
                value="lieferung"
                current={input.fulfillment}
                title="Lieferung"
                detail={`+ ${formatEuro(fees.deliveryCents)} Lieferkosten`}
                onChange={(value) => update("fulfillment", value)}
              />
            </div>
            {errors.fulfillment ? <FieldError message={errors.fulfillment} /> : null}
          </fieldset>

          <div className={styles.fields}>
            <Field
              id="name"
              label="Name"
              autoComplete="name"
              value={input.name}
              error={errors.name}
              onChange={(value) => update("name", value)}
            />
            <Field
              id="phone"
              label="Telefon"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={input.phone}
              error={errors.phone}
              onChange={(value) => update("phone", value)}
            />
          </div>

          {input.fulfillment === "lieferung" ? (
            <div className={styles.fields}>
              <Field
                id="street"
                label="Straße"
                autoComplete="address-line1"
                value={input.street}
                error={errors.street}
                onChange={(value) => update("street", value)}
              />
              <Field
                id="house-number"
                label="Hausnummer"
                value={input.houseNumber}
                error={errors.houseNumber}
                onChange={(value) => update("houseNumber", value)}
              />
              <Field
                id="postal-code"
                label="Postleitzahl"
                inputMode="numeric"
                autoComplete="postal-code"
                value={input.postalCode}
                error={errors.postalCode}
                onChange={(value) => update("postalCode", value)}
              />
              <Field
                id="city"
                label="Ort"
                autoComplete="address-level2"
                value={input.city}
                error={errors.city}
                onChange={(value) => update("city", value)}
              />
            </div>
          ) : null}

          <div className={styles.note}>
            <label htmlFor="order-notes">Hinweis zur Bestellung</label>
            <textarea
              id="order-notes"
              value={input.notes}
              maxLength={240}
              rows={3}
              placeholder="Optional, zum Beispiel Klingel defekt."
              onChange={(event) => update("notes", event.target.value)}
            />
            {errors.notes ? <FieldError message={errors.notes} /> : null}
          </div>

          <fieldset className={styles.group}>
            <legend>Zahlungsart</legend>
            <div className={styles.payments}>
              {paymentMethods.map((method) => {
                const checked = input.payment === method.id;
                return (
                  <label
                    key={method.id}
                    className={`${styles.pay} ${checked ? styles.payOn : ""}`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={method.id}
                      checked={checked}
                      onChange={() => update("payment", method.id as PaymentMethodId)}
                    />
                    <span>{method.name}</span>
                    <small>{method.detail}</small>
                  </label>
                );
              })}
            </div>
            {errors.payment ? <FieldError message={errors.payment} /> : null}
          </fieldset>
        </div>

        <aside className={styles.summary}>
          <h2>Deine Bestellung</h2>
          <ul>
            {lines.map((line) => {
              const item = getItemById(line.itemId);
              const detail = selectionLabels(item, line.selection).join(" · ");
              return (
                <li key={line.lineId}>
                  <span>
                    {line.quantity}× {item.name}
                    {detail ? <small>{detail}</small> : null}
                  </span>
                  <Price cents={lineTotalCents(line)} />
                </li>
              );
            })}
          </ul>
          <p>
            <span>Zwischensumme</span>
            <Price cents={subtotalCents} />
          </p>
          <p>
            <span>Lieferkosten</span>
            {input.fulfillment === "" ? (
              <span>noch offen</span>
            ) : (
              <Price cents={feeCents} />
            )}
          </p>
          <p className={styles.total}>
            <span>Gesamt</span>
            <Price cents={totalCents} />
          </p>
          <button type="submit" className={styles.primary}>
            Bestellung abschicken
          </button>
        </aside>
      </form>
    </section>
  );
}

function Confirmation({ receipt }: { receipt: Receipt }) {
  return (
    <section className={`wrap ${styles.page}`}>
      <p className={styles.kicker}>Demo</p>
      <h1>Bestellung notiert.</h1>
      <p className={styles.orderNo}>{receipt.number}</p>
      <p className={styles.lead}>
        Das ist eine Vorführung. {receipt.name}, deine Angaben bleiben in diesem
        Browser. Es wurde keine Bestellung an ein Lokal geschickt und keine
        Zahlung ausgeführt.
      </p>
      <div className={styles.summary}>
        <h2>{receipt.fulfillment === "lieferung" ? "Lieferung" : "Abholung"}</h2>
        <p className={styles.meta}>
          {receipt.address}
          <br />
          {receipt.phone}
          <br />
          {receipt.payment}
        </p>
        <ul>
          {receipt.lines.map((line) => (
            <li key={`${line.name}-${line.detail}`}>
              <span>
                {line.quantity}× {line.name}
                {line.detail ? <small>{line.detail}</small> : null}
              </span>
              <Price cents={line.totalCents} />
            </li>
          ))}
        </ul>
        <p>
          <span>Zwischensumme</span>
          <Price cents={receipt.subtotalCents} />
        </p>
        <p>
          <span>Lieferkosten</span>
          <Price cents={receipt.feeCents} />
        </p>
        <p className={styles.total}>
          <span>Gesamt</span>
          <Price cents={receipt.totalCents} />
        </p>
        {receipt.notes ? <p className={styles.meta}>Hinweis: {receipt.notes}</p> : null}
      </div>
      <Link href="/speisekarte" className={styles.primary}>
        Weiter auf der Karte
      </Link>
    </section>
  );
}

function FulfillmentOption({
  value,
  current,
  title,
  detail,
  onChange,
}: {
  value: Fulfillment;
  current: string;
  title: string;
  detail: string;
  onChange: (value: Fulfillment) => void;
}) {
  const checked = current === value;
  return (
    <label className={`${styles.pay} ${checked ? styles.payOn : ""}`}>
      <input
        type="radio"
        name="fulfillment"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
      />
      <span>{title}</span>
      <small>{detail}</small>
    </label>
  );
}

function Field({
  id,
  label,
  value,
  error,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "numeric";
}) {
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  );
}

function FieldError({ id, message }: { id?: string; message: string }) {
  return (
    <span id={id} className={styles.error}>
      {message}
    </span>
  );
}
