import type { ButtonHTMLAttributes } from 'react';

type AuthSubmitButtonProps = {
    loading: boolean;
    loadingLabel: string;
    idleLabel: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function AuthSubmitButton({
    loading,
    loadingLabel,
    idleLabel,
    disabled,
    ...props
}: AuthSubmitButtonProps) {
    return (
        <button className="auth-submit" disabled={loading || disabled} {...props}>
            {loading ? loadingLabel : idleLabel}
        </button>
    );
}
