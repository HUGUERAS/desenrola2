type AuthMessageProps = {
    type: 'error' | 'success';
    message: string;
};

export function AuthMessage({ type, message }: AuthMessageProps) {
    if (!message) return null;
    return <div className={type === 'error' ? 'auth-message auth-message-error' : 'auth-message auth-message-success'}>{message}</div>;
}
