import type { InputHTMLAttributes } from 'react';

type AuthFieldProps = {
    label: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function AuthField({ label, ...props }: AuthFieldProps) {
    return (
        <div>
            <label className="auth-label">{label}</label>
            <input className="auth-input" {...props} />
        </div>
    );
}
